import { NextResponse } from "next/server";
import { executeCeoTick } from "@/lib/ceo-runner";

export async function POST() {
  try {
    const result = await executeCeoTick();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

