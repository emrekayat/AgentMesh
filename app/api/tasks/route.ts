import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/tasks`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await fetch(`${BACKEND_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
