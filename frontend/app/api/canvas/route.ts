import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json(null, { status: 400 });
  try {
    const res = await fetch(`${BACKEND}/api/workspaces/${id}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json(null, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(null, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const res = await fetch(`${BACKEND}/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    // Backend offline fallback — generate a local workspace ID for the demo
    return NextResponse.json(
      {
        id: crypto.randomUUID(),
        title: body.title ?? "New Workspace",
        updated_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  }
}
