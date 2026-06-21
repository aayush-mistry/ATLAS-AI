import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAICeodecision } from "@/lib/ai-ceo";
import { createEscrowJob, approveEscrowWorker, releaseEscrowPayment, generateMockTxHash } from "@/lib/web3";
import { executeCeoTick } from "@/lib/ceo-runner";

// Helper to simulate customer sales
async function simulateSales(currentPrice: number, weather: string, demandLevel: number) {
  // Check if there is an active hired worker (assigned job)
  const activeJobs = await prisma.job.findMany({
    where: { status: "ASSIGNED" },
  });

  if (activeJobs.length === 0) {
    return { cupsSold: 0, msg: "Lemonade stand is closed (no active worker on shift)." };
  }

  // Get current inventory
  const inventory = await prisma.inventory.findMany();
  const lemons = inventory.find(i => i.item === "Lemons")?.quantity ?? 0;
  const sugar = inventory.find(i => i.item === "Sugar")?.quantity ?? 0;
  const cups = inventory.find(i => i.item === "Cups")?.quantity ?? 0;
  const ice = inventory.find(i => i.item === "Ice")?.quantity ?? 0;

  // Recipe per cup: 1 Lemon, 1 Sugar, 1 Cup, 2 Ice
  const maxCupsByLemons = lemons;
  const maxCupsBySugar = sugar;
  const maxCupsByCups = cups;
  const maxCupsByIce = Math.floor(ice / 2);

  const maxPossibleSales = Math.min(maxCupsByLemons, maxCupsBySugar, maxCupsByCups, maxCupsByIce);

  if (maxPossibleSales === 0) {
    return { cupsSold: 0, msg: "Stand cannot sell lemonade: Out of ingredients!" };
  }

  // Weather multipliers
  let weatherMult = 1.0;
  if (weather === "Sunny") weatherMult = 1.5;
  else if (weather === "Hot") weatherMult = 2.0;
  else if (weather === "Cloudy") weatherMult = 0.8;
  else if (weather === "Rainy") weatherMult = 0.3;

  // Price multipliers (baseline: ₹25)
  const priceMult = Math.pow(25 / currentPrice, 1.2);

  // Workers capacity: each active worker can serve up to 25 cups per tick
  const capacity = activeJobs.length * 25;

  // Total customer demand (add randomness so each tick varies ±30%)
  const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  const targetSales = Math.round(15 * weatherMult * priceMult * demandLevel * randomFactor);
  const actualCupsSold = Math.min(targetSales, maxPossibleSales, capacity);

  if (actualCupsSold > 0) {
    const revenue = actualCupsSold * currentPrice;

    // Deduct inventory
    await prisma.inventory.update({
      where: { item: "Lemons" },
      data: { quantity: { decrement: actualCupsSold } },
    });
    await prisma.inventory.update({
      where: { item: "Sugar" },
      data: { quantity: { decrement: actualCupsSold } },
    });
    await prisma.inventory.update({
      where: { item: "Cups" },
      data: { quantity: { decrement: actualCupsSold } },
    });
    await prisma.inventory.update({
      where: { item: "Ice" },
      data: { quantity: { decrement: actualCupsSold * 2 } },
    });

    // Update BusinessState
    const state = await prisma.businessState.findUnique({ where: { id: "singleton" } });
    if (state) {
      const newBalance = state.walletBalance + revenue;
      const newRevenue = state.revenue + revenue;
      const newProfit = newRevenue - state.expenses;

      await prisma.businessState.update({
        where: { id: "singleton" },
        data: {
          walletBalance: newBalance,
          revenue: newRevenue,
          profit: newProfit,
        },
      });
    }

    // Log transaction
    await prisma.transaction.create({
      data: {
        type: "DEPOSIT", // Revenue deposit
        amount: revenue,
        entity: "Customer (Bulk Sales)",
        description: `Sold ${actualCupsSold} cups of lemonade at ₹${currentPrice}/cup (Bulk Simulation)`,
      },
    });

    const msg = `Sales Report: Sold ${actualCupsSold} cups of lemonade at ₹${currentPrice} each. Generated ₹${revenue} revenue. (Used ${actualCupsSold} lemons, ${actualCupsSold} sugar, ${actualCupsSold} cups, ${actualCupsSold * 2} ice cubes).`;
    await prisma.activityLog.create({
      data: { message: msg },
    });

    return { cupsSold: actualCupsSold, revenue, msg };
  }

  return { cupsSold: 0, msg: "No sales generated. High pricing or low customer traffic." };
}

export async function POST() {
  try {
    const result = await executeCeoTick();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
