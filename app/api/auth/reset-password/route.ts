import { NextRequest, NextResponse } from "next/server";
import { forwardToBackend } from "@/app/api/_gateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const response = await forwardToBackend(req, "/api/auth/reset-password");
    return response;
  } catch (error) {
    console.error("Error in /api/auth/reset-password:", error);
    return NextResponse.json(
      { message: "Password reset failed", error: (error as Error).message },
      { status: 500 }
    );
  }
}
