import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== SALES PREREQUISITES CHECK ===\n");

  // 1. Active workers (ASSIGNED jobs)
  const assignedJobs = await prisma.job.findMany({ where: { status: "ASSIGNED" } });
  console.log(`Active workers (ASSIGNED jobs): ${assignedJobs.length}`);
  for (const j of assignedJobs) {
    console.log(`  Job: ${j.title} | Payment: ₹${j.payment} | Worker: ${j.workerWallet}`);
  }

  // 2. All jobs
  const allJobs = await prisma.job.findMany();
  console.log(`\nAll jobs (${allJobs.length}):`);
  for (const j of allJobs) {
    console.log(`  [${j.status}] ${j.title} | ₹${j.payment}`);
  }

  // 3. Inventory
  const inventory = await prisma.inventory.findMany();
  console.log(`\nInventory:`);
  for (const i of inventory) {
    console.log(`  ${i.item}: ${i.quantity} units (₹${i.unitCost}/unit)`);
  }
  
  // 4. Can we make lemonade?
  const lemons = inventory.find(i => i.item === "Lemons")?.quantity ?? 0;
  const sugar = inventory.find(i => i.item === "Sugar")?.quantity ?? 0;
  const cups = inventory.find(i => i.item === "Cups")?.quantity ?? 0;
  const ice = inventory.find(i => i.item === "Ice")?.quantity ?? 0;
  const maxPossible = Math.min(lemons, sugar, cups, Math.floor(ice / 2));
  console.log(`\nMax cups we can make: ${maxPossible}`);

  // 5. Business state
  const state = await prisma.businessState.findUnique({ where: { id: "singleton" } });
  console.log(`\nBusiness State:`);
  console.log(`  Balance: ₹${state?.walletBalance}`);
  console.log(`  Price: ₹${state?.lemonadePrice}/cup`);

  // 6. Market conditions
  const market = await prisma.marketCondition.findUnique({ where: { id: "singleton" } });
  console.log(`\nMarket Conditions:`);
  console.log(`  Weather: ${market?.weather}`);
  console.log(`  Demand: ${market?.demandLevel}`);

  console.log("\n=== DIAGNOSIS ===");
  if (assignedJobs.length === 0) {
    console.log("❌ NO ASSIGNED WORKERS - The stand is CLOSED. No sales will happen.");
    console.log("   Fix: An OPEN job needs to have a worker assigned to it.");
  } else if (maxPossible === 0) {
    console.log("❌ OUT OF INGREDIENTS - Cannot make any cups.");
    console.log(`   Lemons: ${lemons}, Sugar: ${sugar}, Cups: ${cups}, Ice: ${ice}`);
  } else {
    console.log("✅ Everything looks good. Sales should be happening.");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
