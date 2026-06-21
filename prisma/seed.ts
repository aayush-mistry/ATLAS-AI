import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database...");

  // 1. Upsert Business State
  await prisma.businessState.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      shopOpen: true,
      walletBalance: 5000.0,
      walletAddress: "0x8eCe6838D6CAd5F62A4FE7CEaC32Ff14aE9f6920",
      lemonadePrice: 25.0,
      revenue: 0.0,
      expenses: 0.0,
      profit: 0.0,
    },
  });

  // 2. Upsert Market Condition
  await prisma.marketCondition.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      weather: "Sunny",
      lemonPrice: 5.0,
      sugarPrice: 2.0,
      cupPrice: 1.0,
      icePrice: 0.5,
      demandLevel: 0.8,
    },
  });

  // 3. Populate Inventory
  const inventoryItems = [
    { item: "Lemons", quantity: 120, unitCost: 5.0 },
    { item: "Sugar", quantity: 150, unitCost: 2.0 },
    { item: "Cups", quantity: 100, unitCost: 1.0 },
    { item: "Ice", quantity: 200, unitCost: 0.5 },
  ];

  for (const item of inventoryItems) {
    await prisma.inventory.upsert({
      where: { item: item.item },
      update: {},
      create: item,
    });
  }

  // 4. Create default workers
  const workers = [
    { name: "Raj Kumar", wallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", role: "WORKER" },
    { name: "Priya Sharma", wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", role: "WORKER" },
    { name: "Amit Patel", wallet: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1", role: "WORKER" },
  ];

  const dbWorkers = [];
  for (const worker of workers) {
    const w = await prisma.user.upsert({
      where: { wallet: worker.wallet },
      update: {},
      create: worker,
    });
    dbWorkers.push(w);
  }

  // 5. Create default jobs
  const jobsData = [
    { title: "Serve lemonade from 10AM to 2PM", payment: 300.0, status: "OPEN" },
    { title: "Restock lemonade stand supplies", payment: 150.0, status: "OPEN" },
    { title: "Squeeze lemons & prepare syrup", payment: 200.0, status: "OPEN" },
  ];

  for (const job of jobsData) {
    // Check if job already exists
    const existing = await prisma.job.findFirst({
      where: { title: job.title },
    });
    if (!existing) {
      const createdJob = await prisma.job.create({
        data: job,
      });

      // Let's create an application for Raj Kumar on the first job, Priya on the second
      if (job.title.startsWith("Serve lemonade")) {
        await prisma.application.create({
          data: {
            jobId: createdJob.id,
            workerId: dbWorkers[0].id,
            status: "PENDING",
          },
        });
      } else if (job.title.startsWith("Restock")) {
        await prisma.application.create({
          data: {
            jobId: createdJob.id,
            workerId: dbWorkers[1].id,
            status: "PENDING",
          },
        });
      }
    }
  }

  // 6. Create initial log
  await prisma.activityLog.create({
    data: {
      message: "Autonomous Legal Entity AI stand initialized with ₹5,000 treasury.",
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
