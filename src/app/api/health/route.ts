import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type HealthStatus = "ok" | "degraded" | "error";

export async function GET() {
  const start = Date.now();
  let dbStatus: HealthStatus = "ok";
  let details: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("health check: database ping failed", error);
    dbStatus = "error";
    details = error instanceof Error ? error.message : "Unknown database error";
  }

  const durationMs = Date.now() - start;

  return NextResponse.json(
    {
      status: "ok",
      database: dbStatus,
      details,
      timestamp: new Date().toISOString(),
      responseTimeMs: durationMs,
    },
    {
      status: dbStatus === "error" ? 500 : 200,
    },
  );
}

