import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeCeoTick } from "@/lib/ceo-runner";

// Lightweight sales simulation — sells 1-3 cups per call
export async function POST() {
  try {
    const state = await prisma.businessState.findUnique({ where: { id: "singleton" } });

    if (!state) {
      return NextResponse.json({ success: false, error: "State not initialized." }, { status: 400 });
    }

    if (!state.shopOpen) {
      return NextResponse.json(
        { success: false, error: "Business Closed", cupsSold: 0, msg: "Business Closed" },
        { status: 403 }
      );
    }

    // Check for active worker
    const activeJobs = await prisma.job.findMany({
      where: { status: "ASSIGNED" },
    });

    if (activeJobs.length === 0) {
      return NextResponse.json({ success: true, cupsSold: 0, msg: "Stand closed (no worker)." });
    }

    // Get market conditions
    const market = await prisma.marketCondition.findUnique({ where: { id: "singleton" } });

    if (!market) {
      return NextResponse.json({ success: false, error: "State not initialized." }, { status: 400 });
    }

    // Get inventory
    const inventory = await prisma.inventory.findMany();
    const lemons = inventory.find(i => i.item === "Lemons")?.quantity ?? 0;
    const sugar = inventory.find(i => i.item === "Sugar")?.quantity ?? 0;
    const cups = inventory.find(i => i.item === "Cups")?.quantity ?? 0;
    const ice = inventory.find(i => i.item === "Ice")?.quantity ?? 0;

    // Max cups we can make right now
    const maxPossible = Math.min(lemons, sugar, cups, Math.floor(ice / 2));

    if (maxPossible === 0) {
      return NextResponse.json({ success: true, cupsSold: 0, msg: "Out of ingredients!" });
    }

    // Weather affects whether a customer shows up
    let weatherChance = 0.6; // base chance a customer arrives
    if (market.weather === "Sunny") weatherChance = 0.8;
    else if (market.weather === "Hot") weatherChance = 0.95;
    else if (market.weather === "Cloudy") weatherChance = 0.4;
    else if (market.weather === "Rainy") weatherChance = 0.15;

    // Demand affects how many cups (1-3) a customer wants
    const demandBoost = market.demandLevel; // 0 to 1

    // Roll: does a customer show up this tick?
    const customerArrives = Math.random() < weatherChance;
    if (!customerArrives) {
      return NextResponse.json({ success: true, cupsSold: 0, msg: "No customer this moment." });
    }

    // How many cups does this customer buy? (1-3, influenced by demand)
    const maxBuy = Math.min(
      Math.ceil(Math.random() * 2 + demandBoost), // 1 to 3
      maxPossible
    );
    const cupsSold = Math.max(1, maxBuy);
    const revenue = cupsSold * state.lemonadePrice;

    // Deduct inventory
    await prisma.inventory.update({ where: { item: "Lemons" }, data: { quantity: { decrement: cupsSold } } });
    await prisma.inventory.update({ where: { item: "Sugar" }, data: { quantity: { decrement: cupsSold } } });
    await prisma.inventory.update({ where: { item: "Cups" }, data: { quantity: { decrement: cupsSold } } });
    await prisma.inventory.update({ where: { item: "Ice" }, data: { quantity: { decrement: cupsSold * 2 } } });

    // Update balance
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

    // Record transaction
    await prisma.transaction.create({
      data: {
        type: "DEPOSIT",
        amount: revenue,
        entity: "Customer (Lemonade Sale)",
        description: `Sold ${cupsSold} cup${cupsSold > 1 ? "s" : ""} at ₹${state.lemonadePrice}/cup`,
      },
    });

    // After selling, check if any inventory item went low. If so, trigger a CEO tick to buy inventory.
    const latestInventory = await prisma.inventory.findMany();
    const lowLemons = latestInventory.find(i => i.item === "Lemons")?.quantity ?? 0;
    const lowSugar = latestInventory.find(i => i.item === "Sugar")?.quantity ?? 0;
    const lowCups = latestInventory.find(i => i.item === "Cups")?.quantity ?? 0;
    const lowIce = latestInventory.find(i => i.item === "Ice")?.quantity ?? 0;

    if (lowLemons < 50 || lowSugar < 50 || lowCups < 50 || lowIce < 100) {
      try {
        await executeCeoTick();
      } catch (ceoErr) {
        console.error("Auto-decision error on low inventory in sales:", ceoErr);
      }
    }

    return NextResponse.json({
      success: true,
      cupsSold,
      revenue,
      price: state.lemonadePrice,
      newBalance,
      msg: `🍋 Sold ${cupsSold} cup${cupsSold > 1 ? "s" : ""} for ₹${revenue}!`,
    });

  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
