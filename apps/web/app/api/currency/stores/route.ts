import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeSlug } from "@/lib/currency/policy";

export const runtime = "nodejs";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid store name" }, { status: 400 });
  const slug = storeSlug(parsed.data.name);
  if (!slug) return NextResponse.json({ error: "Store name must contain letters or numbers" }, { status: 400 });
  try {
    const store = await db.currencyStore.create({ data: { ownerUserId: session.userId, name: parsed.data.name, slug } });
    await db.auditEvent.create({ data: { userId: session.userId, actorType: "USER", action: "CURRENCY_STORE_CREATED", resource: "CurrencyStore", resourceId: store.id, outcome: "SUCCESS" } });
    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A store with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create store" }, { status: 500 });
  }
}
