import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))
  const { requestId, status, comments, approverName, approvalDate } = body
  if (!requestId || !status) return NextResponse.json({ ok: false, error: 'requestId and status required' }, { status: 400 })

  return NextResponse.json({
    ok: true,
    requestId,
    status,
    comments: comments || '',
    approverName: approverName || 'Dept Head',
    approvalDate: approvalDate || new Date().toISOString().slice(0,10),
    recordedAt: new Date().toISOString(),
  })
}
