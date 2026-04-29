import { NextResponse } from "next/server";
import { discoverAgents } from "@/lib/ens/registry";

export async function GET() {
  const agents = await discoverAgents();
  return NextResponse.json({ agents });
}
