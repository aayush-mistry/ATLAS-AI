import { prisma } from "./prisma";

export interface DecisionResult {
  action: "BUY_INVENTORY" | "INCREASE_PRICES" | "REDUCE_PRICES" | "HIRE_WORKER" | "PAY_WORKER" | "SAVE_FUNDS";
  reason: string;
  expectedImpact: string;
}

export async function runAICeodecision(): Promise<DecisionResult> {
  // 1. Fetch current business state
  const state = await prisma.businessState.findUnique({
    where: { id: "singleton" },
  });

  const inventory = await prisma.inventory.findMany();
  const market = await prisma.marketCondition.findUnique({
    where: { id: "singleton" },
  });

  const openJobs = await prisma.job.findMany({
    where: { status: "OPEN" },
    include: { applications: { where: { status: "PENDING" }, include: { worker: true } } },
  });

  const completedJobs = await prisma.job.findMany({
    where: { status: "COMPLETED" },
  });

  const balance = state?.walletBalance ?? 0;
  const currentPrice = state?.lemonadePrice ?? 20;

  const lemons = inventory.find((i) => i.item === "Lemons")?.quantity ?? 0;
  const sugar = inventory.find((i) => i.item === "Sugar")?.quantity ?? 0;
  const cups = inventory.find((i) => i.item === "Cups")?.quantity ?? 0;
  const ice = inventory.find((i) => i.item === "Ice")?.quantity ?? 0;

  const weather = market?.weather ?? "Sunny";
  const lemonCost = market?.lemonPrice ?? 5.0;
  const sugarCost = market?.sugarPrice ?? 2.0;
  const cupCost = market?.cupPrice ?? 1.0;
  const iceCost = market?.icePrice ?? 0.5;
  const demand = market?.demandLevel ?? 0.8;

  // Check if OpenAI API Key is present
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      console.log("Calling OpenAI GPT-4o API for CEO decision...");
      const systemPrompt = `You are the AI CEO of an autonomous lemonade stand business called "Autonomous Legal Entity AI".
You make decisions, manage funds, hire workers, and execute payments without human intervention.
Every 60 seconds you analyze the business state and return your next action.

You must return ONLY a JSON object with this exact structure:
{
  "action": "BUY_INVENTORY" | "INCREASE_PRICES" | "REDUCE_PRICES" | "HIRE_WORKER" | "PAY_WORKER" | "SAVE_FUNDS",
  "reason": "Clear explanation of the data points driving this decision",
  "expectedImpact": "Quantifiable expected result on inventory, cash, or worker productivity"
}

Constraints & Rules:
1. BUY_INVENTORY: Buy if any inventory count (Lemons, Sugar, Cups, Ice) is below 50 AND you have at least ₹600.
2. HIRE_WORKER: Hire if there are open jobs with pending applications, and wallet balance is at least the job payment + ₹500.
3. PAY_WORKER: Pay if there are completed jobs. This is your highest priority to maintain trust.
4. INCREASE_PRICES: Increase by ₹5 if weather is "Sunny" or "Hot", demand > 0.7, and current price < ₹35.
5. REDUCE_PRICES: Reduce by ₹5 if weather is "Rainy" or "Cloudy", demand < 0.5, and current price > ₹15.
6. SAVE_FUNDS: If no critical action is needed, save cash.`;

      const userPrompt = `Current Business State:
- Treasury Balance: ₹${balance.toFixed(2)}
- Current Lemonade Price: ₹${currentPrice.toFixed(2)}
- Inventory:
  * Lemons: ${lemons} (Market Cost: ₹${lemonCost}/unit)
  * Sugar: ${sugar} units (Market Cost: ₹${sugarCost}/unit)
  * Cups: ${cups} units (Market Cost: ₹${cupCost}/unit)
  * Ice: ${ice} cubes (Market Cost: ₹${iceCost}/unit)
- Market Conditions:
  * Weather: ${weather}
  * Demand Level: ${demand * 100}%
- Hiring Marketplace:
  * Open jobs: ${openJobs.length} (${openJobs.map(j => `${j.title} (pay: ₹${j.payment}) with ${j.applications.length} applicants`).join(", ")})
  * Completed jobs waiting payment: ${completedJobs.length} (${completedJobs.map(j => j.title).join(", ")})`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        return {
          action: content.action,
          reason: content.reason,
          expectedImpact: content.expectedImpact,
        };
      } else {
        console.warn(`OpenAI API returned status ${response.status}. Falling back to Rule Engine.`);
      }
    } catch (err) {
      console.warn("OpenAI API call failed. Falling back to Rule Engine. Error:", err);
    }
  }

  // --- RULE ENGINE FALLBACK ---
  console.log("Using local AI CEO rule-based engine...");

  // Priority 1: Pay Completed Jobs
  if (completedJobs.length > 0) {
    const job = completedJobs[0];
    return {
      action: "PAY_WORKER",
      reason: `Worker has successfully completed the job: "${job.title}". As the AI CEO, I must execute the escrow release of ₹${job.payment} to their wallet address in accordance with our smart contract agreement.`,
      expectedImpact: `Wallet balance will decrease by ₹${job.payment}. Active worker list will be updated, and contract transactions will be logged in the treasury registry.`,
    };
  }

  // Priority 2: Restock Inventory if critically low
  const lowItems = [];
  if (lemons < 50) lowItems.push(`${50 - lemons} Lemons`);
  if (sugar < 50) lowItems.push(`${50 - sugar} Sugar`);
  if (cups < 50) lowItems.push(`${50 - cups} Cups`);
  if (ice < 100) lowItems.push(`${100 - ice} Ice`);

  if (lowItems.length > 0 && balance >= 600) {
    const itemsList = lowItems.join(", ");
    return {
      action: "BUY_INVENTORY",
      reason: `Current inventory level is low. We are running low on [${itemsList}]. The weather is ${weather} with a ${Math.round(demand * 100)}% demand level, requiring a restock to maintain sales velocity.`,
      expectedImpact: `Spend approximately ₹250 to restock supplies. This will prevent stockouts and allow us to continue serving customers during peak business hours.`,
    };
  }

  // Priority 3: Hire workers if there are open jobs and pending applications
  const jobToHire = openJobs.find(j => j.applications.length > 0);
  if (jobToHire && balance >= (jobToHire.payment + 500)) {
    const applicant = jobToHire.applications[0];
    return {
      action: "HIRE_WORKER",
      reason: `The job "${jobToHire.title}" (Payment: ₹${jobToHire.payment}) has pending applications. Hiring ${applicant.worker.name} (Wallet: ${applicant.worker.wallet.slice(0, 6)}...${applicant.worker.wallet.slice(-4)}) to automate stand sales during the day.`,
      expectedImpact: `₹${jobToHire.payment} will be locked in the Escrow Smart Contract. Once hired, this worker will manage lemonade sales, increasing our production output.`,
    };
  }

  // Priority 4: Adjust Prices based on weather
  if ((weather === "Sunny" || weather === "Hot") && demand > 0.7 && currentPrice < 35) {
    const newPrice = currentPrice + 5;
    return {
      action: "INCREASE_PRICES",
      reason: `Weather conditions are optimal (${weather}) and demand level is high (${Math.round(demand * 100)}%). Customer willingness to pay is elevated. Adjusting pricing will maximize gross margins.`,
      expectedImpact: `Unit price increased from ₹${currentPrice} to ₹${newPrice}. Expected revenue per cup will rise by 20% with minimal impact on volume.`,
    };
  }

  if ((weather === "Rainy" || weather === "Cloudy") && demand < 0.5 && currentPrice > 15) {
    const newPrice = currentPrice - 5;
    return {
      action: "REDUCE_PRICES",
      reason: `Weather conditions are poor (${weather}) causing a drop in customer foot traffic and demand (${Math.round(demand * 100)}%). Lowering prices will incentivize volume.`,
      expectedImpact: `Unit price reduced from ₹${currentPrice} to ₹${newPrice}. Lower margins are offset by maintaining sales velocity and preventing inventory waste.`,
    };
  }

  // Default: Save Funds
  return {
    action: "SAVE_FUNDS",
    reason: `All systems nominal. Inventory is healthy (Lemons: ${lemons}, Sugar: ${sugar}, Cups: ${cups}, Ice: ${ice}). Wallet balance (₹${balance.toFixed(2)}) is preserved, and current pricing (₹${currentPrice}) matches market conditions.`,
    expectedImpact: `No capital expenditure or operational changes. Storing liquid funds in treasury to prepare for future supply cost changes or job creations.`,
  };
}
