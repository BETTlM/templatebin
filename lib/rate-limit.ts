import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type InMemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, InMemoryBucket>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = redisUrl && redisToken
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisToken }),
      limiter: Ratelimit.fixedWindow(20, "1 m"),
      analytics: true,
      prefix: "anonymous-meme-vault",
    })
  : null;

export async function enforceRateLimit(identifier: string) {
  if (ratelimit) {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  const now = Date.now();
  const current = memoryBuckets.get(identifier);
  if (!current || now > current.resetAt) {
    memoryBuckets.set(identifier, { count: 1, resetAt: now + 60_000 });
    return { success: true, remaining: 19, reset: now + 60_000 };
  }

  current.count += 1;
  const remaining = Math.max(0, 20 - current.count);
  return {
    success: current.count <= 20,
    remaining,
    reset: current.resetAt,
  };
}
