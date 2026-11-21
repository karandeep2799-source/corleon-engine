import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;

function authorized(request: NextRequest): boolean {
  const expected = process.env.FINANCE_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const a = createHmac("sha256", "corleon-finance-auth").update(expected).digest();
  const b = createHmac("sha256", "corleon-finance-auth").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.FINANCE_API_TOKEN) {
    return NextResponse.json({ error: "Finance parsing is not configured. Set FINANCE_API_TOKEN before enabling uploads." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parserUrl = process.env.HDFC_PARSER_URL;
  const parserToken = process.env.HDFC_PARSER_TOKEN;
  if (!parserUrl || !parserToken) return NextResponse.json({ error: "HDFC parser service is not configured." }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 }); }
  const file = form.get("statement");
  const cardholderName = form.get("cardholderName");
  const password = form.get("pdfPassword");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Upload a PDF statement smaller than 4 MB." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Only PDF statements are accepted." }, { status: 415 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "The uploaded file is not a valid PDF." }, { status: 415 });
  if (typeof cardholderName !== "string" || cardholderName.trim().length < 2 || cardholderName.length > 120) return NextResponse.json({ error: "Enter the cardholder name as printed on the statement." }, { status: 400 });
  if (typeof password !== "string" || password.length > 256) return NextResponse.json({ error: "Invalid PDF password." }, { status: 400 });
  const upstream = new FormData();
  upstream.set("statement", new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" }), "statement.pdf");
  upstream.set("cardholderName", cardholderName.trim());
  upstream.set("pdfPassword", password);
  let response: Response;
  try {
    response = await fetch(parserUrl, { method: "POST", headers: { authorization: `Bearer ${parserToken}` }, body: upstream, signal: AbortSignal.timeout(50_000), cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "The statement parser is temporarily unavailable." }, { status: 502 });
  }
  if (!response.ok) return NextResponse.json({ error: "The parser could not process this statement. Check the PDF password and supported statement format." }, { status: 422 });
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { transactions?: unknown }).transactions)) return NextResponse.json({ error: "Parser returned an invalid response." }, { status: 502 });
  const transactions = (payload as { transactions: unknown[] }).transactions;
  if (transactions.length > 10000 || transactions.some((row) => {
    if (!row || typeof row !== "object") return true;
    const tx = row as Record<string, unknown>;
    const validDate = typeof tx.date === "string" && Number.isFinite(Date.parse(tx.date));
    const validDescription = typeof tx.description === "string" && tx.description.trim().length > 0 && tx.description.length <= 500;
    const validAmount = (typeof tx.amount === "number" && Number.isFinite(tx.amount)) || (typeof tx.amount === "string" && /^-?\d{1,12}(?:\.\d{1,4})?$/.test(tx.amount)) || (typeof tx.amountPaise === "number" && Number.isSafeInteger(tx.amountPaise));
    const validPoints = tx.rewardPoints === undefined || (typeof tx.rewardPoints === "number" && Number.isSafeInteger(tx.rewardPoints));
    return !(validDate && validDescription && validAmount && validPoints);
  })) return NextResponse.json({ error: "Parser returned invalid or excessive transaction data." }, { status: 502 });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, private" } });
}
