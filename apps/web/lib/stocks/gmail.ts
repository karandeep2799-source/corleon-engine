import { bitcoinPrisma } from "../bitcoin/prisma";
import { decryptRefreshToken } from "./session";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
type GmailPart = { mimeType?: string; filename?: string; partId?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: GmailPart[] };
export type GmailMessage = {
  id: string; threadId?: string; internalDate?: string; snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }>; body?: { data?: string }; parts?: GmailPart[] };
};

export async function getGmailAccessToken(email: string): Promise<string> {
  const connection = await bitcoinPrisma.gmailConnection.findUnique({ where: { email: email.toLowerCase() } });
  if (!connection) throw new Error("Gmail is not connected for this account.");
  const refreshToken = decryptRefreshToken(connection.refreshTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error || "Could not refresh Gmail access. Reconnect the Google account.");
  return data.access_token;
}
async function gmailFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `Gmail API returned ${response.status}.`);
  return data;
}
export async function listStockEmailMessages(accessToken: string, pageToken?: string, maxResults = 100): Promise<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate: number; failedMessages: number }> {
  const query = '{ "contract note" "trade confirmation" "portfolio statement" holdings dividend demat equity shares stocks "consolidated account statement" "CAS statement" "trade book" "order executed" "capital gains" "tax P&L" NSDL CDSL }';
  const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, Math.max(1, maxResults))) });
  if (pageToken) params.set("pageToken", pageToken);
  const page = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string; resultSizeEstimate?: number }>(`/messages?${params}`, accessToken);
  const ids = page.messages ?? [];
  const fetched = await mapLimit(ids, 8, async (message) => {
    try { return await gmailFetch<GmailMessage>(`/messages/${encodeURIComponent(message.id)}?format=full`, accessToken); }
    catch { return null; }
  });
  const messages = fetched.filter((message): message is GmailMessage => message !== null);
  return { messages, nextPageToken: page.nextPageToken, resultSizeEstimate: page.resultSizeEstimate ?? messages.length, failedMessages: fetched.length - messages.length };
}
async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await run(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
function decodeBody(data?: string): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
type AttachmentMetadata = { filename: string; mimeType: string; parsed: boolean };
function collectParts(parts: GmailPart[] | undefined, output: { plain: string[]; html: string[]; attachments: GmailPart[] }) {
  for (const part of parts ?? []) {
    if (part.filename) output.attachments.push(part);
    const decoded = decodeBody(part.body?.data);
    if (decoded && part.mimeType === "text/plain") output.plain.push(decoded);
    else if (decoded && part.mimeType === "text/html") output.html.push(decoded);
    if (part.parts?.length) collectParts(part.parts, output);
  }
}
async function getAttachmentText(messageId: string, part: GmailPart, accessToken: string): Promise<string | null> {
  const fileName = (part.filename || "").toLowerCase();
  const mime = (part.mimeType || "").toLowerCase();
  if (!(fileName.endsWith(".csv") || fileName.endsWith(".txt") || fileName.endsWith(".tsv") || mime === "text/csv" || mime === "text/tab-separated-values" || mime === "text/plain")) return null;
  if ((part.body?.size ?? 0) > 1_000_000) return null;
  let encoded = part.body?.data;
  if (!encoded && part.body?.attachmentId) {
    try {
      const attachment = await gmailFetch<{ data?: string; size?: number }>("/messages/" + encodeURIComponent(messageId) + "/attachments/" + encodeURIComponent(part.body.attachmentId), accessToken);
      if ((attachment.size ?? 0) > 1_000_000) return null;
      encoded = attachment.data;
    } catch {
      return null;
    }
  }
  const text = decodeBody(encoded);
  return text && text.length <= 1_000_000 ? text : null;
}
export async function readMessageContent(message: GmailMessage, accessToken: string) {
  const output = { plain: [] as string[], html: [] as string[], attachments: [] as GmailPart[] };
  collectParts(message.payload?.parts, output);
  const root = decodeBody(message.payload?.body?.data);
  if (root && !output.plain.length && !output.html.length) output.plain.push(root);
  const attachmentContent = await Promise.all(output.attachments.map((part) => getAttachmentText(message.id, part, accessToken)));
  const csvAttachments = attachmentContent.flatMap((value, index) => value ? [{
    filename: (output.attachments[index].filename || "statement.csv").slice(0, 180),
    text: value,
  }] : []);
  const htmlText = output.html.join("\n")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
  const body = [output.plain.join("\n") || htmlText, ...csvAttachments.map((attachment) => "\n[Attachment: " + attachment.filename + "]\n" + attachment.text)]
    .join("\n").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, 60_000);
  const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
  const attachments: AttachmentMetadata[] = output.attachments.map((part, index) => ({
    filename: (part.filename || "attachment").slice(0, 180),
    mimeType: (part.mimeType || "application/octet-stream").slice(0, 120),
    parsed: attachmentContent[index] !== null,
  }));
  return {
    body,
    csvAttachments,
    subject: (headers.get("subject") || "(No subject)").slice(0, 500),
    sender: (headers.get("from") || "").slice(0, 320),
    attachments,
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)) : new Date(),
  };
}
