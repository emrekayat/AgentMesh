import { NextResponse } from "next/server";
import { getTopologySnapshot } from "@/lib/axl/topology";
import { MOCK_TOPOLOGY } from "@/lib/mock/seed";

export async function GET() {
  const live = await getTopologySnapshot();
  return NextResponse.json({ topology: live ?? MOCK_TOPOLOGY });
}
