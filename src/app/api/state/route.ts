import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const state = await prisma.businessState.findUnique({
      where: { id: "singleton" },
    });

    const inventory = await prisma.inventory.findMany();
    const market = await prisma.marketCondition.findUnique({
      where: { id: "singleton" },
    });

    const jobs = await prisma.job.findMany({
      include: {
        applications: {
          include: {
            worker: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const recentDecisions = await prisma.decision.findMany({
      take: 50,
      orderBy: { timestamp: "desc" },
    });

    const recentLogs = await prisma.activityLog.findMany({
      take: 20,
      orderBy: { timestamp: "desc" },
    });

    const activeWorkerCount = await prisma.job.count({
      where: { status: "ASSIGNED" },
    });

    return NextResponse.json({
      success: true,
      state,
      inventory,
      market,
      jobs,
      recentDecisions,
      recentLogs,
      activeWorkerCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { price, shopOpen } = await request.json();

    if (shopOpen !== undefined) {
      if (typeof shopOpen !== "boolean") {
        return NextResponse.json({ success: false, error: "Invalid shop status value." }, { status: 400 });
      }

      const current = await prisma.businessState.findUnique({
        where: { id: "singleton" },
      });

      if (!current) {
        return NextResponse.json({ success: false, error: "State not initialized." }, { status: 400 });
      }

      if (current.shopOpen === shopOpen) {
        return NextResponse.json({ success: true, state: current });
      }

      const updated = await prisma.businessState.update({
        where: { id: "singleton" },
        data: { shopOpen },
      });

      await prisma.activityLog.create({
        data: {
          message: shopOpen
            ? "Business opened. Customer purchases and revenue generation are enabled."
            : "Business closed. Customer purchases and sales revenue are paused.",
        },
      });

      return NextResponse.json({ success: true, state: updated });
    }

    if (price === undefined || typeof price !== "number" || price <= 0) {
      return NextResponse.json({ success: false, error: "Invalid price value." }, { status: 400 });
    }

    const updated = await prisma.businessState.update({
      where: { id: "singleton" },
      data: { lemonadePrice: price },
    });

    await prisma.activityLog.create({
      data: {
        message: `Lemonade price updated manually to ₹${price.toFixed(2)} per cup.`,
      },
    });

    return NextResponse.json({ success: true, state: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
