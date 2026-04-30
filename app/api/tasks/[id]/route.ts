import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const res = await fetch(`${BACKEND_URL}/tasks/${id}`, { cache: "no-store" });
  if (res.status === 404) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
