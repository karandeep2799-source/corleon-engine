import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { getStockSession, isSameOrigin } from "@/lib/stocks/session";
import { getGmailAccessToken, listStockEmailMessages, readMessageContent } from "@/lib/stocks/gmail";
import { extractTradesFromEmail, extractTradesFromCsv } from "@/lib/stocks/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getStockSession();
  if (!session) return NextResponse.json({ error: "Connect your Gmail account first." }, { status: 401 });

  try {
    const now = new Date();
    const previous = await bitcoinPrisma.stockSyncState.findUnique({ where: { ownerEmail: session.email } });
    if (previous?.lastSyncStartedAt && now.getTime() - previous.lastSyncStartedAt.getTime() < 5_000) {
      return NextResponse.json({ error: "Please wait a few seconds between mailbox scans." }, { status: 429 });
    }
    const restartingScan = !previous || previous.scanComplete;
    const nextPageToken = restartingScan ? undefined : previous?.nextPageToken ?? undefined;
    await bitcoinPrisma.stockSyncState.upsert({
      where: { ownerEmail: session.email },
      create: { ownerEmail: session.email, lastSyncStartedAt: now },
      update: { lastSyncStartedAt: now },
    });

    const accessToken = await getGmailAccessToken(session.email);
    const batch = await listStockEmailMessages(accessToken, nextPageToken, 100);
    let newTransactions = 0;
    let candidateTransactions = 0;
    let attachmentEmails = 0;
    let matchedEmails = 0;

    for (const message of batch.messages) {
      if (!message.id) continue;
      const parsedEmail = await readMessageContent(message, accessToken);
      const trades = [
        ...extractTradesFromEmail({
          ownerEmail: session.email,
          messageId: message.id,
          subject: parsedEmail.subject,
          body: parsedEmail.body,
          receivedAt: parsedEmail.receivedAt,
        }),
        ...parsedEmail.csvAttachments.flatMap((attachment) => extractTradesFromCsv({
          ownerEmail: session.email,
          messageId: message.id,
          fileName: attachment.filename,
          text: attachment.text,
          receivedAt: parsedEmail.receivedAt,
        })),
      ];
      candidateTransactions += trades.length;
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
        const unique = { ownerEmail_fingerprint: { ownerEmail: session.email, fingerprint: trade.fingerprint } };
        const existing = await bitcoinPrisma.stockTransaction.findUnique({ where: unique, select: { id: true } });
        await bitcoinPrisma.stockTransaction.upsert({
          where: unique,
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
          update: { evidenceId: evidence.id },
        });
        if (!existing) newTransactions++;
      }
    }

    const complete = !batch.nextPageToken;
    const scannedCount = (restartingScan ? 0 : previous?.scannedCount ?? 0) + batch.messages.length;
    const candidateCount = (restartingScan ? 0 : previous?.candidateCount ?? 0) + candidateTransactions;
    await bitcoinPrisma.stockSyncState.update({
      where: { ownerEmail: session.email },
      data: {
        lastSyncedAt: new Date(),
        scannedCount,
        candidateCount,
        nextPageToken: batch.nextPageToken ?? null,
        scanComplete: complete,
      },
    });
    return NextResponse.json({
      ok: true,
      scannedThisBatch: batch.messages.length,
      scannedEmails: scannedCount,
      matchedEmails,
      candidateTransactions,
      newTransactions,
      attachmentEmails,
      failedMessages: batch.failedMessages,
      estimatedMatchingEmails: batch.resultSizeEstimate,
      hasMore: !complete,
      note: "The scan parses email text and supported CSV/text attachments. PDF and spreadsheet binaries are listed but not parsed in this release. Every extracted trade remains unverified until you approve it.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock Intelligence Gmail sync failed", error);
    const message = error instanceof Error ? error.message : "Mailbox scan failed.";
    return NextResponse.json({ error: message.includes("Gmail") || message.includes("Google") ? message : "Could not scan this mailbox. Check Gmail permissions and database configuration." }, { status: 502 });
  }
}
