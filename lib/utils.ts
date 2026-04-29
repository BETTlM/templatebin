import { createHash, randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";

export function normalizeTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

export function buildStoragePath(fileName: string) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
  return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
}

export function hashIp(ip: string | null): string {
  const { ipSalt } = getEnv();
  return createHash("sha256").update(`${ipSalt}:${ip ?? "unknown"}`).digest("hex");
}

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }

  return headers.get("x-real-ip");
}
