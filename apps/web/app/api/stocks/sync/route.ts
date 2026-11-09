import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { getStockSession, isSameOrigin } from "@/lib/stocks/session";
import { getGmailAccessToken, listStockEmailMessages, readMessageContent } from "@/lib/stocks/gmail";
import { extractTradesFromEmail } from "@/lib/stocks/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getStockSession();
  if (!session) return NextResponse.json({ error: "Connect your Gmail account first." }, { status: 401 });

  try {
    const now = new Date();
    const previous = await bitcoinPrisma.stockSyncState.findUnique({ where: { ownerEmail: session.email } });
    if (previous?.lastSyncStartedAt && now.getTime() - previous.lastSyncStartedAt.getTime() < 30_000) {
      return NextResponse.json({ error: "Please wait 30 seconds between mailbox scans." }, { status: 429 });
    }
    await bitcoinPrisma.stockSyncState.upsert({
      where: { ownerEmail: session.email },
      create: { ownerEmail: session.email, lastSyncStartedAt: now },
      update: { lastSyncStartedAt: now },
    });

    const accessToken = await getGmailAccessToken(session.email);
    const messages = await listStockEmailMessages(accessToken, 200);
    let newTransactions = 0;
    let candidateTransactions = 0;
    let attachmentEmails = 0;
    let matchedEmails = 0;

    for (const message of messages) {
      if (!message.id) continue;
      const parsedEmail = readMessageContent(message);
      const trades = extractTradesFromEmail({
        ownerEmail: session.email,
        messageId: message.id,
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        receivedAt: parsedEmail.receivedAt,
      });
      if (trades.length) candidateTransactions += trades.length;
      if (parsedEmail.attachments.length) attachmentEmails++;

      const evidence = await bitcoinPrisma.stockEmailEvidence.upsert({
        where: { ownerEmail_gmailMessageId: { ownerEmail: session.email, gmailMessageId: message.id } },
        create: {
          ownerEmail: session.email,
          gmailMessageId: message.id,
          threadId: message.threadId,
          subject: parsedEmail.subject,
          sender: parsedEmail.sender || null,
          receivedAt: parsedEmail.receivedAt,
          attachmentNames: parsedEmail.attachments,
          hasFinancialData: trades.length > 0,
        },
        update: {
          threadId: message.threadId,
          subject: parsedEmail.subject,
          sender: parsedEmail.sender || null,
          receivedAt: parsedEmail.receivedAt,
          attachmentNames: parsedEmail.attachments,
          hasFinancialData: trades.length > 0,
          scannedAt: now,
        },
      });
      if (trades.length) matchedEmails++;

      for (const trade of trades) {
        const result = await bitcoinPrisma.stockTransaction.upsert({
          where: { ownerEmail_fingerprint: { ownerEmail: session.email, fingerprint: trade.fingerprint } },
          create: {
            ownerEmail: session.email,
            evidenceId: evidence.id,
            symbol: trade.symbol,
            type: trade.type,
            quantity: trade.quantity,
            price: trade.price,
            amount: trade.quantity * trade.price,
            currency: trade.currency,
            executedAt: trade.executedAt,
            confidence: trade.confidence,
            reviewStatus: "NEEDS_REVIEW",
            evidenceExcerpt: trade.evidenceExcerpt,
            fingerprint: trade.fingerprint,
          },
          update: {},
          select: { createdAt: true },
        });
        if (result.createdAt.getTime() >= now.getTime() - 1000) newTransactions++;
      }
    }

    await bitcoinPrisma.stockSyncState.update({
      where: { ownerEmail: session.email },
      data: { lastSyncedAt: new Date(), scannedCount: messages.length, candidateCount: candidateTransactions },
    });
    return NextResponse.json({
      ok: true,
      scannedEmails: messages.length,
      matchedEmails,
      candidateTransactions,
      newTransactions,
      attachmentEmails,
      scanLimit: 200,
      note: "Email attachments are listed as evidence but are not parsed. Every extracted transaction remains unverified until you approve it.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock Intelligence Gmail sync failed", error);
    const message = error instanceof Error ? error.message : "Mailbox scan failed.";
    return NextResponse.json({ error: message.includes("Gmail") || message.includes("Google") ? message : "Could not scan this mailbox. Check Gmail permissions and database configuration." }, { status: 502 });
  }
}
