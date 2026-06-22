import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMockTxHash } from "@/lib/web3";
import { executeCeoTick } from "@/lib/ceo-runner";

export async function GET() {
  try {
    const state = await prisma.businessState.findUnique({
      where: { id: "singleton" },
    });

    const transactions = await prisma.transaction.findMany({
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json({
      success: true,
      balance: state?.walletBalance ?? 0,
      address: state?.walletAddress ?? "0x8eCe6838D6CAd5F62A4FE7CEaC32Ff14aE9f6920",
      transactions,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, amount, toAddress } = body;

    if (!amount || parseFloat(amount.toString()) <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be greater than 0." }, { status: 400 });
    }

    const value = parseFloat(amount.toString());

    if (action === "DEPOSIT") {
      const state = await prisma.businessState.findUnique({ where: { id: "singleton" } });
      if (!state) {
        return NextResponse.json({ success: false, error: "Business state not initialized." }, { status: 400 });
      }

      const hash = generateMockTxHash();

      await prisma.businessState.update({
        where: { id: "singleton" },
        data: { walletBalance: { increment: value } },
      });

      const tx = await prisma.transaction.create({
        data: {
          type: "DEPOSIT",
          amount: value,
          txHash: hash,
          entity: "Owner (Deposit)",
          description: "Manual treasury funding deposit",
        },
      });

      await prisma.activityLog.create({
        data: {
          message: `Treasury wallet deposited with ₹${value} (Transaction Tx: ${hash.slice(0, 10)}...).`,
        },
      });

      try {
        await executeCeoTick();
      } catch (ceoErr) {
        console.error("Auto-decision error on DEPOSIT:", ceoErr);
      }

      return NextResponse.json({ success: true, transaction: tx });
    }

    if (action === "WITHDRAWAL") {
      const state = await prisma.businessState.findUnique({ where: { id: "singleton" } });
      if (!state) {
        return NextResponse.json({ success: false, error: "Business state not initialized." }, { status: 400 });
      }

      if (state.walletBalance < value) {
        return NextResponse.json({ success: false, error: "Insufficient balance in treasury." }, { status: 400 });
      }

      const hash = generateMockTxHash();

      await prisma.businessState.update({
        where: { id: "singleton" },
        data: { walletBalance: { decrement: value } },
      });

      const tx = await prisma.transaction.create({
        data: {
          type: "WITHDRAWAL",
          amount: value,
          txHash: hash,
          entity: toAddress ? `External Wallet (${toAddress.slice(0, 6)}...${toAddress.slice(-4)})` : "Owner (Withdrawal)",
          description: toAddress ? `Manual funds transfer to ${toAddress}` : "Manual treasury funds withdrawal",
        },
      });

      const recipient = toAddress || "External Wallet";
      await prisma.activityLog.create({
        data: {
          message: `Sent payment of ₹${value} to ${recipient} from treasury (Transaction Tx: ${hash.slice(0, 10)}...).`,
        },
      });

      return NextResponse.json({ success: true, transaction: tx });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
