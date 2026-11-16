import { NextResponse } from "next/server";
import {
  AngelOneApiError,
  getAngelOnePortfolio,
  isAuthorizedAngelOneRequest,
} from "../../../../../lib/angelone/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (process.env.ANGELONE_PRIVATE_API_ENABLED !== "true") {
    return NextResponse.json({ error: "Angel One portfolio monitoring is disabled." }, { status: 503, headers });
  }
  if (!isAuthorizedAngelOneRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  }

  try {
    return NextResponse.json(await getAngelOnePortfolio(), { headers });
  } catch (error) {
    if (error instanceof AngelOneApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Unable to retrieve Angel One portfolio." }, { status: 500, headers });
  }
}
