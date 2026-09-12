import { NextResponse } from "next/server";

// This endpoint returns the WhatsApp connection state.
// The actual state is maintained in the worker process.
// For now we fetch it from the database/Redis via a shared status key.

export async function GET() {
  try {
    // Read connection state from Redis
    const IORedis = (await import("ioredis")).default;
    const redis = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });

    const state = await redis.get("whatsapp:connection:state").catch(() => null);
    redis.disconnect();

    return NextResponse.json({
      state: state || "DISCONNECTED",
    });
  } catch {
    return NextResponse.json({ state: "DISCONNECTED" });
  }
}
