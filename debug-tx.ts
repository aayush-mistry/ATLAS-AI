import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "dev.db");
const url = `file:${dbPath}`;
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  console.log("=== TRANSACTION LEDGER DEBUG ===");
  console.log("Current system time (ISO):", now.toISOString());
  console.log("Current system time (local):", now.toLocaleString());
  console.log("Timezone offset (minutes):", now.getTimezoneOffset());
  console.log("");

  const allTx = await prisma.transaction.findMany({
    orderBy: { timestamp: "desc" },
  });

  console.log(`Total transactions: ${allTx.length}`);
  console.log("");

  // Show all transactions with their raw timestamps
  console.log("=== ALL TRANSACTIONS (newest first) ===");
  for (const tx of allTx) {
    const ts = tx.timestamp;
    const tsDate = new Date(ts);
    const diffMs = now.getTime() - tsDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    console.log(`  [${tx.type}] ₹${tx.amount} | Raw: ${JSON.stringify(ts)} | ISO: ${tsDate.toISOString()} | ${diffHours.toFixed(1)}h ago | entity: ${tx.entity}`);
  }

  console.log("");

  // Check what "today" means
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  console.log("Today start (local midnight):", todayStart.toISOString());
  
  const todayTx = allTx.filter(tx => new Date(tx.timestamp) >= todayStart);
  console.log(`Transactions from today: ${todayTx.length}`);
  
  if (todayTx.length > 0) {
    console.log("Today's transactions:");
    for (const tx of todayTx) {
      console.log(`  [${tx.type}] ₹${tx.amount} at ${new Date(tx.timestamp).toISOString()} - ${tx.description}`);
    }
  } else {
    console.log("\n!!! NO TRANSACTIONS FROM TODAY !!!");
    console.log("Most recent transaction timestamp:", allTx.length > 0 ? new Date(allTx[0].timestamp).toISOString() : "N/A");
    console.log("Time since most recent transaction:", allTx.length > 0 ? ((now.getTime() - new Date(allTx[0].timestamp).getTime()) / (1000 * 60 * 60)).toFixed(1) + " hours" : "N/A");
  }

  // Show the most recent 5 transactions
  console.log("\n=== MOST RECENT 5 TRANSACTIONS (with getRelativeTime output) ===");
  for (const tx of allTx.slice(0, 5)) {
    const tsDate = new Date(tx.timestamp);
    const diffSec = Math.floor((now.getTime() - tsDate.getTime()) / 1000);
    let relative = "";
    if (diffSec < 5) relative = "just now";
    else if (diffSec < 60) relative = `${diffSec}s ago`;
    else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)} min ago`;
    else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
    else {
      const diffDays = Math.floor(diffSec / 86400);
      relative = diffDays === 1 ? "yesterday" : `${diffDays}d ago`;
    }
    
    console.log(`  ${relative} | [${tx.type}] ₹${tx.amount} | ${tsDate.toISOString()} | ${tx.entity} | ${tx.description}`);
  }

  // Simulate what the API would return (JSON serialization)
  console.log("\n=== FIRST TX AS JSON (what API sends) ===");
  if (allTx.length > 0) {
    console.log(JSON.stringify(allTx[0], null, 2));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
