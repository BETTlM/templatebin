import { NextResponse } from "next/server";
import { cacheGetJson, cacheSetJson } from "@/lib/cache";
import { getServiceSupabase } from "@/lib/supabase";

type TagCount = { tag: string; count: number };
const TAGS_CACHE_KEY = "tags:list:v1";

export async function GET() {
  const cached = await cacheGetJson<TagCount[]>(TAGS_CACHE_KEY);
  if (cached) {
    return NextResponse.json(
      { data: cached },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("meme_templates")
    .select("tags")
    .range(0, 4999);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    tags.forEach((rawTag) => {
      const tag = String(rawTag || "").trim().toLowerCase();
      if (!tag) return;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  const payload = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 120);

  await cacheSetJson(TAGS_CACHE_KEY, payload, 120);

  return NextResponse.json(
    { data: payload },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
