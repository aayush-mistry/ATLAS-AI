import { prisma } from "./prisma";
import { runAICeodecision } from "./ai-ceo";
import { createEscrowJob, releaseEscrowPayment, generateMockTxHash } from "./web3";

export async function executeCeoTick() {
  // 1. Fetch current state before decision
  const state = await prisma.businessState.findUnique({
    where: { id: "singleton" },
  });
  const market = await prisma.marketCondition.findUnique({
    where: { id: "singleton" },
  });

  if (!state || !market) {
    throw new Error("Business state or market conditions not initialized.");
  }

  // 2. Trigger AI Decision Engine
  const decision = await runAICeodecision();

  // 3. Save the Decision to DB
  let dbDecision = await prisma.decision.create({
    data: {
      action: decision.action,
      reason: decision.reason,
      expectedImpact: decision.expectedImpact,
    },
  });

  // Write AI decision to activity logs
  await prisma.activityLog.create({
    data: {
      message: `CEO Decision: [${decision.action}] - ${decision.reason}`,
    },
  });

  // 4. Process AI CEO Action
  let actionResultMsg = "";
  let stateChanged = false;

  if (decision.action === "BUY_INVENTORY") {
    // Restock amount
    const buyLemons = 50;
    const buySugar = 50;
    const buyCups = 50;
    const buyIce = 100;

    const totalCost =
      buyLemons * market.lemonPrice +
      buySugar * market.sugarPrice +
      buyCups * market.cupPrice +
      buyIce * market.icePrice;

    if (state.walletBalance >= totalCost) {
      // Deduct balance
      await prisma.businessState.update({
        where: { id: "singleton" },
        data: {
          walletBalance: { decrement: totalCost },
          expenses: { increment: totalCost },
          profit: { decrement: totalCost },
        },
      });

      // Add inventory
      await prisma.inventory.update({ where: { item: "Lemons" }, data: { quantity: { increment: buyLemons } } });
      await prisma.inventory.update({ where: { item: "Sugar" }, data: { quantity: { increment: buySugar } } });
      await prisma.inventory.update({ where: { item: "Cups" }, data: { quantity: { increment: buyCups } } });
      await prisma.inventory.update({ where: { item: "Ice" }, data: { quantity: { increment: buyIce } } });

      // Record Transaction
      await prisma.transaction.create({
        data: {
          type: "INVENTORY_BUY",
          amount: totalCost,
          entity: "Supplier (Lemonade Ingredients)",
          description: `Bought 50 lemons, 50 sugar, 50 cups, 100 ice`,
        },
      });

      actionResultMsg = `Purchased supplies: 50 lemons, 50 sugar, 50 cups, 100 ice for ₹${totalCost.toFixed(2)}.`;
      stateChanged = true;
    } else {
      actionResultMsg = `Attempted to buy inventory, but treasury balance (₹${state.walletBalance.toFixed(2)}) was insufficient for the cost (₹${totalCost.toFixed(2)}).`;
    }

  } else if (decision.action === "INCREASE_PRICES") {
    const newPrice = state.lemonadePrice + 5;
    await prisma.businessState.update({
      where: { id: "singleton" },
      data: { lemonadePrice: newPrice },
    });
    actionResultMsg = `Adjusted Pricing: Increased cup price from ₹${state.lemonadePrice} to ₹${newPrice}.`;
    stateChanged = true;

  } else if (decision.action === "REDUCE_PRICES") {
    const newPrice = Math.max(15, state.lemonadePrice - 5);
    await prisma.businessState.update({
      where: { id: "singleton" },
      data: { lemonadePrice: newPrice },
    });
    actionResultMsg = `Adjusted Pricing: Reduced cup price from ₹${state.lemonadePrice} to ₹${newPrice}.`;
    stateChanged = true;

  } else if (decision.action === "HIRE_WORKER") {
    // Find open job with pending applicants
    const openJobs = await prisma.job.findMany({
      where: { status: "OPEN" },
      include: { applications: { where: { status: "PENDING" }, include: { worker: true } } },
    });

    const hireableJob = openJobs.find(j => j.applications.length > 0);
    if (hireableJob) {
      const application = hireableJob.applications[0];
      const worker = application.worker;

      if (state.walletBalance >= hireableJob.payment) {
        // Blockchain Escrow Lock (Real or Mocked)
        const numericJobId = Math.floor(Math.random() * 100000);
        const web3Result = await createEscrowJob(numericJobId, hireableJob.payment / 1000);

        // Deduct from wallet balance
        await prisma.businessState.update({
          where: { id: "singleton" },
          data: {
            walletBalance: { decrement: hireableJob.payment },
            expenses: { increment: hireableJob.payment },
            profit: { decrement: hireableJob.payment },
          },
        });

        // Mark job as assigned
        await prisma.job.update({
          where: { id: hireableJob.id },
          data: {
            status: "ASSIGNED",
            workerWallet: worker.wallet,
          },
        });

        // Approve this worker
        await prisma.application.update({
          where: { id: application.id },
          data: { status: "APPROVED" },
        });

        // Reject other applicants
        await prisma.application.updateMany({
          where: { jobId: hireableJob.id, id: { not: application.id } },
          data: { status: "REJECTED" },
        });

        // Record transaction
        await prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: hireableJob.payment,
            txHash: web3Result.txHash,
            entity: `Worker (${worker.name})`,
            description: `Escrow Lock: Pay for job "${hireableJob.title}"`,
          },
        });

        actionResultMsg = `Hired worker ${worker.name} for job "${hireableJob.title}". locked ₹${hireableJob.payment} in Escrow contract (Tx: ${web3Result.txHash.slice(0, 10)}...).`;
        stateChanged = true;
      } else {
        actionResultMsg = `Attempted to hire ${worker.name}, but stand balance (₹${state.walletBalance}) is insufficient for escrow lock (₹${hireableJob.payment}).`;
      }
    } else {
      actionResultMsg = "AI decided to hire a worker, but no active job applications are available.";
    }

  } else if (decision.action === "PAY_WORKER") {
    const completedJobs = await prisma.job.findMany({
      where: { status: "COMPLETED" },
    });

    if (completedJobs.length > 0) {
      const job = completedJobs[0];
      // Release Escrow Contract
      const web3Result = await releaseEscrowPayment(Math.floor(Math.random() * 10000));

      await prisma.job.update({
        where: { id: job.id },
        data: { status: "PAID" },
      });

      const workerUser = job.workerWallet
        ? await prisma.user.findFirst({ where: { wallet: job.workerWallet } })
        : null;
      const workerName = workerUser ? workerUser.name : "Assigned Worker";

      // Record transaction log
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: job.payment,
          txHash: web3Result.txHash,
          entity: `Worker (${workerName})`,
          description: `Escrow Release: Pay for completed job "${job.title}"`,
        },
      });

      actionResultMsg = `Released payment of ₹${job.payment} to worker for completed job: "${job.title}" (Contract Release Tx: ${web3Result.txHash.slice(0, 10)}...).`;
      stateChanged = true;
    } else {
      actionResultMsg = "AI decided to pay workers, but no jobs are currently marked completed.";
    }

  } else {
    actionResultMsg = "AI CEO elected to hold current funds. Reviewing supply levels and stand pricing.";
  }

  if (actionResultMsg) {
    await prisma.activityLog.create({
      data: { message: actionResultMsg },
    });
  }

  // AUTO-RECOVERY: If no active workers exist, auto-create a job + worker + hire them
  const activeJobs = await prisma.job.findMany({ where: { status: "ASSIGNED" } });
  if (activeJobs.length === 0) {
    const latestState = await prisma.businessState.findUnique({ where: { id: "singleton" } });
    const hirePayment = 200;

    if (latestState && latestState.walletBalance >= hirePayment) {
      // Random worker names pool
      const workerNames = ["Aarav Mehta", "Sneha Iyer", "Vikram Das", "Ananya Rao", "Karan Joshi", "Diya Nair", "Rohan Gupta", "Meera Shah", "Arjun Reddy", "Priya Verma"];
      const workerName = workerNames[Math.floor(Math.random() * workerNames.length)];
      const workerWallet = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

      // Create worker
      const worker = await prisma.user.create({
        data: {
          name: workerName,
          wallet: workerWallet,
          role: "WORKER",
        },
      });

      // Create job
      const jobTitles = ["Serve lemonade & manage stand", "Prepare fresh batches of lemonade", "Handle customer orders & sales", "Run the afternoon lemonade shift"];
      const jobTitle = jobTitles[Math.floor(Math.random() * jobTitles.length)];

      const job = await prisma.job.create({
        data: {
          title: jobTitle,
          payment: hirePayment,
          status: "ASSIGNED",
          workerWallet: workerWallet,
        },
      });

      // Create approved application
      await prisma.application.create({
        data: {
          jobId: job.id,
          workerId: worker.id,
          status: "APPROVED",
        },
      });

      // Deduct payment (escrow lock)
      const escrowHash = generateMockTxHash();
      await prisma.businessState.update({
        where: { id: "singleton" },
        data: {
          walletBalance: { decrement: hirePayment },
          expenses: { increment: hirePayment },
          profit: { decrement: hirePayment },
        },
      });

      // Record transaction
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: hirePayment,
          txHash: escrowHash,
          entity: `Worker (${workerName})`,
          description: `Auto-Hire Escrow Lock: "${jobTitle}"`,
        },
      });

      const autoHireMsg = `🔄 Auto-Recovery: No active workers detected. Hired ${workerName} for "${jobTitle}" and locked ₹${hirePayment} in escrow (Tx: ${escrowHash.slice(0, 10)}...). Stand is now open!`;
      await prisma.activityLog.create({
        data: { message: autoHireMsg },
      });

      actionResultMsg = actionResultMsg
        ? `${actionResultMsg} | ${autoHireMsg}`
        : autoHireMsg;
      stateChanged = true;
    }
  }

  // 5. Follow-up State Update
  // If stateChanged is true, run decision engine again on the *new* state and save that decision!
  if (stateChanged) {
    const nextDecision = await runAICeodecision();
    dbDecision = await prisma.decision.create({
      data: {
        action: nextDecision.action,
        reason: nextDecision.reason,
        expectedImpact: nextDecision.expectedImpact,
      },
    });

    await prisma.activityLog.create({
      data: {
        message: `CEO Decision Update: [${nextDecision.action}] - ${nextDecision.reason}`,
      },
    });
  }

  const updatedState = await prisma.businessState.findUnique({ where: { id: "singleton" } });
  const updatedInventory = await prisma.inventory.findMany();

  return {
    decision: dbDecision,
    actionResultMsg,
    updatedState,
    updatedInventory,
  };
}
