//! Private HTTP adapter for the upstream HDFC parser.
//! The upstream parser is included as a Rust module so PDF passwords are passed
//! in memory to its parse() function, never placed in process arguments.
#[path = "../../../vendor/hdfc-cc-parser-rs/src/main.rs"]
mod upstream;

use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::NaiveDateTime;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    env,
    io::Write,
    net::SocketAddr,
    sync::{mpsc, Arc},
};
use subtle::ConstantTimeEq;
use tempfile::Builder;
use tokio::{sync::Semaphore, task};

const MAX_PDF_BYTES: usize = 15 * 1024 * 1024;
const MAX_NAME_BYTES: usize = 120;
const MAX_PASSWORD_BYTES: usize = 256;
const MAX_TRANSACTIONS: usize = 10_000;

#[derive(Clone)]
struct AppState {
    token_digest: Arc<[u8; 32]>,
    parse_slots: Arc<Semaphore>,
}

#[derive(Serialize)]
struct ParseResponse {
    transactions: Vec<ParsedTransaction>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedTransaction {
    date: String,
    description: String,
    reward_points: i32,
    amount: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
}

fn error(status: StatusCode, message: &'static str) -> Response {
    (status, Json(ErrorResponse { error: message })).into_response()
}

fn authorized(headers: &HeaderMap, expected_digest: &[u8; 32]) -> bool {
    let Some(value) = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) else {
        return false;
    };
    let Some(token) = value.strip_prefix("Bearer ").or_else(|| value.strip_prefix("bearer ")) else {
        return false;
    };
    if token.is_empty() || token.len() > 512 {
        return false;
    }
    let supplied_digest = Sha256::digest(token.as_bytes());
    bool::from(supplied_digest.as_slice().ct_eq(expected_digest.as_slice()))
}

async fn health() -> &'static str {
    "ok"
}

async fn parse_statement(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Response {
    if !authorized(&headers, state.token_digest.as_ref()) {
        return error(StatusCode::UNAUTHORIZED, "Unauthorized");
    }

    let permit = match state.parse_slots.clone().try_acquire_owned() {
        Ok(permit) => permit,
        Err(_) => return error(StatusCode::TOO_MANY_REQUESTS, "Parser is busy; retry shortly."),
    };

    let mut statement: Option<Vec<u8>> = None;
    let mut cardholder_name: Option<String> = None;
    let mut pdf_password: Option<String> = None;

    loop {
        let field = match multipart.next_field().await {
            Ok(Some(field)) => field,
            Ok(None) => break,
            Err(_) => return error(StatusCode::BAD_REQUEST, "Invalid multipart request."),
        };
        let name = field.name().unwrap_or_default().to_owned();
        match name.as_str() {
            "statement" => {
                if statement.is_some() {
                    return error(StatusCode::BAD_REQUEST, "Only one statement file is accepted.");
                }
                let content_type = field.content_type().unwrap_or_default().to_owned();
                let file_name = field.file_name().unwrap_or_default().to_owned();
                if content_type != "application/pdf" && !file_name.to_ascii_lowercase().ends_with(".pdf") {
                    return error(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Only PDF statements are accepted.");
                }
                let bytes = match field.bytes().await {
                    Ok(bytes) if !bytes.is_empty() && bytes.len() <= MAX_PDF_BYTES => bytes,
                    _ => return error(StatusCode::BAD_REQUEST, "Upload a PDF statement smaller than 15 MB."),
                };
                if !bytes.starts_with(b"%PDF-") {
                    return error(StatusCode::UNSUPPORTED_MEDIA_TYPE, "The uploaded file is not a valid PDF.");
                }
                statement = Some(bytes.to_vec());
            }
            "cardholderName" => {
                if cardholder_name.is_some() {
                    return error(StatusCode::BAD_REQUEST, "Duplicate cardholder name field.");
                }
                let value = match field.text().await {
                    Ok(value) if value.trim().len() >= 2 && value.len() <= MAX_NAME_BYTES => value.trim().to_owned(),
                    _ => return error(StatusCode::BAD_REQUEST, "Enter the cardholder name as printed on the statement."),
                };
                cardholder_name = Some(value);
            }
            "pdfPassword" => {
                if pdf_password.is_some() {
                    return error(StatusCode::BAD_REQUEST, "Duplicate PDF password field.");
                }
                let value = match field.text().await {
                    Ok(value) if value.len() <= MAX_PASSWORD_BYTES => value,
                    _ => return error(StatusCode::BAD_REQUEST, "Invalid PDF password."),
                };
                pdf_password = Some(value);
            }
            _ => return error(StatusCode::BAD_REQUEST, "Unexpected multipart field."),
        }
    }

    let (Some(bytes), Some(name), Some(password)) = (statement, cardholder_name, pdf_password) else {
        return error(StatusCode::BAD_REQUEST, "Statement, cardholderName and pdfPassword are required.");
    };

    let parsed = task::spawn_blocking(move || {
        let _permit = permit;
        let mut temp = Builder::new().prefix("corleon-hdfc-").suffix(".pdf").tempfile()?;
        temp.write_all(&bytes)?;
        temp.flush()?;
        let path = temp.path().to_string_lossy().into_owned();
        let (tx, rx) = mpsc::channel::<Vec<String>>();
        upstream::parse(path, name, password, &tx)?;
        drop(tx);

        let mut transactions = Vec::new();
        for row in rx {
            if transactions.len() >= MAX_TRANSACTIONS {
                anyhow::bail!("transaction limit exceeded");
            }
            if row.len() != 4 {
                anyhow::bail!("unexpected parser row shape");
            }
            let date = NaiveDateTime::parse_from_str(&row[0], "%Y-%m-%d %H:%M:%S")
                .or_else(|_| NaiveDateTime::parse_from_str(&row[0], "%Y-%m-%dT%H:%M:%S"))?;
            let description = row[1].trim().to_owned();
            let reward_points: i32 = row[2].parse()?;
            let amount: f32 = row[3].parse()?;
            if description.is_empty() || description.len() > 500 || !amount.is_finite() {
                anyhow::bail!("invalid parsed transaction");
            }
            transactions.push(ParsedTransaction {
                date: date.format("%Y-%m-%dT%H:%M:%S").to_string(),
                description,
                reward_points,
                amount: format!("{amount:.2}"),
            });
        }
        Ok::<_, anyhow::Error>(transactions)
    })
    .await;

    match parsed {
        Ok(Ok(transactions)) => Json(ParseResponse { transactions }).into_response(),
        Ok(Err(_)) => error(StatusCode::UNPROCESSABLE_ENTITY, "The statement could not be parsed. Check the PDF password and supported HDFC statement format."),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "The parser failed unexpectedly."),
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // The upstream CLI module supports verbose debug output through this variable.
    // Remove it before serving so statement text can never be written to stderr.
    env::remove_var("DEBUG");

    let token = env::var("HDFC_PARSER_TOKEN")
        .map_err(|_| anyhow::anyhow!("HDFC_PARSER_TOKEN must be configured"))?;
    if token.len() < 32 {
        anyhow::bail!("HDFC_PARSER_TOKEN must contain at least 32 characters");
    }
    let digest: [u8; 32] = Sha256::digest(token.as_bytes()).into();
    let state = AppState {
        token_digest: Arc::new(digest),
        parse_slots: Arc::new(Semaphore::new(2)),
    };

    let app = Router::new()
        .route("/healthz", get(health))
        .route("/v1/parse", post(parse_statement))
        .layer(DefaultBodyLimit::max(MAX_PDF_BYTES + 1024 * 1024))
        .with_state(state);

    let address: SocketAddr = env::var("BIND_ADDRESS")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_owned())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
