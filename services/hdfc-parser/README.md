# Corleon HDFC Parser Service

Private HTTP adapter for the MIT-licensed upstream parser, pinned as a Git submodule at commit `e83d36d2ab8e99b4c2537226ce6aef2289cded6f`.

## Why this adapter is Rust-native

The upstream project exposes a Rust `parse(path, cardholder_name, password, sender)` function inside its CLI source. This service includes that source as a module and calls the parser directly. The PDF password is therefore passed in memory; it is never placed in a child-process argument list or shell command.

Supported source formats are limited to the upstream project's documented HDFC Infinia statements from September 2025 onward, Regalia Gold (tested from February 2026), and RuPay UPI (tested from March 2026). Other statement formats must be treated as unsupported until verified.

## Build

Run from the repository root after cloning with submodules:

```sh
git submodule update --init --recursive
docker build -f services/hdfc-parser/Dockerfile -t corleon-hdfc-parser .
```

## Run privately

Generate a random token of at least 32 characters and inject it through your secret manager. Do not commit it.

```sh
docker run --rm --name corleon-hdfc-parser \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --memory=512m --cpus=1 --pids-limit=64 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  -p 127.0.0.1:8080:8080 \
  -e HDFC_PARSER_TOKEN \
  corleon-hdfc-parser
``

The service has a two-request parser concurrency limit, a 15 MiB PDF limit, a 16 MiB request-body limit, strict multipart fields, a fixed transaction ceiling, and automatic temporary-file cleanup. It runs as a non-root user. Keep it on a private network; expose it only to the Corleon web server over TLS or a private service mesh. Do not publish port 8080 publicly.

## API

- `GET /healthz` returns a static health response.
- `POST /v1/parse` requires `Authorization: Bearer <HDFC_PARSER_TOKEN>` and multipart fields `statement` (PDF), `cardholderName`, and `pdfPassword`.
- Success returns `{ "transactions": [{ "date": "YYYY-MM-DDTHH:mm:ss", "description": "...", "rewardPoints": 0, "amount": "-123.45" }] }`.

The service does not persist uploads or parsed transactions and does not log request bodies, passwords, or parser output. It removes the upstream parser's `DEBUG` environment switch at startup to prevent statement text from reaching stderr.

## Important limitations

The upstream parser itself uses floating-point `f32` amounts and has no page-count or PDF-object limits. The adapter adds upload, concurrency, and container resource limits, but these are not a substitute for parser fuzzing and adversarial PDF testing. Run it with the documented CPU/memory/PID limits and private ingress. Before enabling production uploads, validate permitted synthetic fixtures for every supported card layout, add fuzzing/security review, and deploy with TLS and authenticated per-user authorization at the web tier.
