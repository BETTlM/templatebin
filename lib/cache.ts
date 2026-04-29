import { Redis } from "@upstash/redis";

type MemoryEntry = { value: string; expiresAt: number };
const memoryCache = new Map<string, MemoryEntry>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function fromMemory(key: string): string | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function toMemory(key: string, value: string, ttlSec: number) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const memoryHit = fromMemory(key);
  if (memoryHit) {
    const parsed = tryParseJson<T>(memoryHit);
    if (parsed !== null) return parsed;
    memoryCache.delete(key);
  }

  if (!redis) return null;
  const redisHit = await redis.get<string>(key);
  if (!redisHit) return null;
  const parsed = tryParseJson<T>(redisHit);
  if (parsed === null) {
    await redis.del(key);
    return null;
  }
  toMemory(key, redisHit, 15);
  return parsed;
}

export async function cacheSetJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const serialized = JSON.stringify(value);
  toMemory(key, serialized, ttlSec);
  if (!redis) return;
  await redis.set(key, serialized, { ex: ttlSec });
}

export async function cacheDel(key: string): Promise<void> {
  memoryCache.delete(key);
  if (!redis) return;
  await redis.del(key);
}

export async function cacheDelPrefix(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  if (!redis) return;

  let cursor = "0";
  do {
    const result = await redis.scan(cursor, { match: `${prefix}*`, count: 200 });
    cursor = result[0];
    const keys = result[1] ?? [];
    if (keys.length) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}
