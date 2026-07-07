import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
      nodeEnv: process.env.NODE_ENV,
    },
  });
}
