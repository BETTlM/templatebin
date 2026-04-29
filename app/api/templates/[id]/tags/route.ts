import { z } from "zod";
import { NextResponse } from "next/server";
import { cacheDelPrefix } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";
import { getClientIp } from "@/lib/utils";

const bodySchema = z.object({
  tag: z.string().trim().min(1).max(40),
});

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
}

async function invalidateTagRelatedCaches() {
  await Promise.all([
    cacheDelPrefix("feed:recent:v4:"),
    cacheDelPrefix("search:v3:"),
    cacheDelPrefix("tags:list:v1"),
  ]);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request.headers);
  const rate = await enforceRateLimit(`tags:${ip ?? "unknown"}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const params = await context.params;
  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const tag = normalizeTag(payload.data.tag);
  if (!tag) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const currentResult = await supabase
    .from("meme_templates")
    .select("tags")
    .eq("id", params.id)
    .single();

  if (currentResult.error || !currentResult.data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const currentTags = Array.isArray(currentResult.data.tags)
    ? currentResult.data.tags.map((item) => String(item).toLowerCase())
    : [];
  const nextTags = Array.from(new Set([...currentTags, tag])).slice(0, 20);

  const updateResult = await supabase
    .from("meme_templates")
    .update({ tags: nextTags })
    .eq("id", params.id)
    .select("tags")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: updateResult.error?.message ?? "Failed to update tags" }, { status: 500 });
  }

  await invalidateTagRelatedCaches();
  return NextResponse.json({ tags: updateResult.data.tags });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request.headers);
  const rate = await enforceRateLimit(`tags:${ip ?? "unknown"}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const params = await context.params;
  const payload = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const tag = normalizeTag(payload.data.tag);
  const supabase = getServiceSupabase();
  const currentResult = await supabase
    .from("meme_templates")
    .select("tags")
    .eq("id", params.id)
    .single();

  if (currentResult.error || !currentResult.data) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const currentTags = Array.isArray(currentResult.data.tags)
    ? currentResult.data.tags.map((item) => String(item).toLowerCase())
    : [];
  const nextTags = currentTags.filter((item) => item !== tag);

  const updateResult = await supabase
    .from("meme_templates")
    .update({ tags: nextTags })
    .eq("id", params.id)
    .select("tags")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: updateResult.error?.message ?? "Failed to update tags" }, { status: 500 });
  }

  await invalidateTagRelatedCaches();
  return NextResponse.json({ tags: updateResult.data.tags });
}
