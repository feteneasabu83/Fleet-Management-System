import { NextRequest } from "next/server";
import { forwardToBackend } from "@/app/api/_gateway";

export const dynamic = "force-dynamic";

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `/api/maintenance-approval/${(path || []).join("/")}`;
  return forwardToBackend(req, target);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
