import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Creating test transaction...");
  const tx = await prisma.transaction.create({
    data: {
      type: "DEPOSIT",
      amount: 100.0,
      entity: "Test Entity",
      description: "Test transaction from script",
    }
  });
  console.log("Created test transaction:", tx);
  
  const count = await prisma.transaction.count();
  console.log("Total transactions now:", count);
  
  // Clean up
  await prisma.transaction.delete({ where: { id: tx.id } });
  console.log("Cleaned up test transaction.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
