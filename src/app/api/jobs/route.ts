import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeCeoTick } from "@/lib/ceo-runner";

export async function GET() {
  try {
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
    return NextResponse.json({ success: true, jobs });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "CREATE") {
      const { title, payment } = body;
      if (!title || !payment) {
        return NextResponse.json({ success: false, error: "Missing title or payment." }, { status: 400 });
      }

      const job = await prisma.job.create({
        data: {
          title,
          payment: parseFloat(payment.toString()),
          status: "OPEN",
        },
      });

      await prisma.activityLog.create({
        data: {
          message: `New job created on marketplace: "${title}" paying ₹${payment}.`,
        },
      });

      return NextResponse.json({ success: true, job });
    }

    if (action === "APPLY") {
      const { jobId, workerName, workerWallet } = body;
      if (!jobId || !workerName || !workerWallet) {
        return NextResponse.json({ success: false, error: "Missing jobId, workerName, or workerWallet." }, { status: 400 });
      }

      // Check if job exists and is open
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.status !== "OPEN") {
        return NextResponse.json({ success: false, error: "Job is not open for applications." }, { status: 400 });
      }

      // Find or create worker
      let worker = await prisma.user.findUnique({
        where: { wallet: workerWallet },
      });

      if (!worker) {
        worker = await prisma.user.create({
          data: {
            name: workerName,
            wallet: workerWallet,
            role: "WORKER",
          },
        });
      }

      // Check if already applied
      const existingApp = await prisma.application.findFirst({
        where: { jobId, workerId: worker.id },
      });

      if (existingApp) {
        return NextResponse.json({ success: false, error: "Worker has already applied for this job." }, { status: 400 });
      }

      const application = await prisma.application.create({
        data: {
          jobId,
          workerId: worker.id,
          status: "PENDING",
        },
      });

      await prisma.activityLog.create({
        data: {
          message: `${workerName} applied for job: "${job.title}".`,
        },
      });

      try {
        await executeCeoTick();
      } catch (ceoErr) {
        console.error("Auto-decision error on APPLY:", ceoErr);
      }

      return NextResponse.json({ success: true, application });
    }

    if (action === "COMPLETE") {
      const { jobId } = body;
      if (!jobId) {
        return NextResponse.json({ success: false, error: "Missing jobId." }, { status: 400 });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.status !== "ASSIGNED") {
        return NextResponse.json({ success: false, error: "Job is not in progress." }, { status: 400 });
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED" },
      });

      await prisma.activityLog.create({
        data: {
          message: `Worker declared completion for job: "${job.title}". Awaiting AI CEO payment release approval.`,
        },
      });

      try {
        await executeCeoTick();
      } catch (ceoErr) {
        console.error("Auto-decision error on COMPLETE:", ceoErr);
      }

      return NextResponse.json({ success: true, job: updatedJob });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
