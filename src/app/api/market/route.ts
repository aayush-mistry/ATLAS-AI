import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const market = await prisma.marketCondition.findUnique({
      where: { id: "singleton" },
    });
    return NextResponse.json({ success: true, market });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const weatherOptions = ["Sunny", "Hot", "Cloudy", "Rainy"];
    const newWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    let demand = 0.8;
    let lemonPrice = 5.0;
    let icePrice = 0.5;

    if (newWeather === "Sunny") {
      demand = 0.9 + Math.random() * 0.1; // 0.9 to 1.0
      lemonPrice = 5.0 + Math.random() * 2.0; // Spikes supply cost
      icePrice = 0.7; // Ice is expensive
    } else if (newWeather === "Hot") {
      demand = 1.0; // Max demand
      lemonPrice = 6.0 + Math.random() * 2.0;
      icePrice = 0.9;
    } else if (newWeather === "Cloudy") {
      demand = 0.5 + Math.random() * 0.2; // 0.5 to 0.7
      lemonPrice = 4.0;
      icePrice = 0.4;
    } else if (newWeather === "Rainy") {
      demand = 0.2 + Math.random() * 0.2; // 0.2 to 0.4
      lemonPrice = 3.0;
      icePrice = 0.3;
    }

    const sugarPrice = 2.0 + (Math.random() - 0.5) * 0.5; // fluctuation around 2.0
    const cupPrice = 1.0; // stable

    const updatedMarket = await prisma.marketCondition.update({
      where: { id: "singleton" },
      data: {
        weather: newWeather,
        lemonPrice: parseFloat(lemonPrice.toFixed(2)),
        sugarPrice: parseFloat(sugarPrice.toFixed(2)),
        cupPrice,
        icePrice: parseFloat(icePrice.toFixed(2)),
        demandLevel: parseFloat(demand.toFixed(2)),
      },
    });

    await prisma.activityLog.create({
      data: {
        message: `Market Oracle Shift: Weather is now "${newWeather}" (Demand: ${Math.round(demand * 100)}%, Lemons cost: ₹${lemonPrice.toFixed(2)}/u).`,
      },
    });

    return NextResponse.json({ success: true, market: updatedMarket });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
