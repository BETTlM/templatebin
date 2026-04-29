import { NextResponse } from "next/server";
import { cacheGetJson, cacheSetJson } from "@/lib/cache";
import { getSignedPreviewMap } from "@/lib/preview-url-cache";
import { getServiceSupabase } from "@/lib/supabase";

const DEFAULT_LIMIT = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? "0");
  const limitRaw = Number(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`);
  const force = searchParams.get("force") === "1";
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
  const safeLimit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 40) : DEFAULT_LIMIT;
  const cacheKey = `feed:recent:v4:${safeOffset}:${safeLimit}`;

  if (!force) {
    const cached = await cacheGetJson<unknown[]>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { data: cached },
        { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" } },
      );
    }
  }

  const supabase = getServiceSupabase();
  const primaryResult = await supabase
    .from("meme_templates")
    .select("id,title,tags,storage_path,mime_type,width,height,uploader_name,download_count,created_at")
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  const queryResult = primaryResult.error?.message.includes("uploader_name")
    ? await supabase
      .from("meme_templates")
      .select("id,title,tags,storage_path,mime_type,width,height,download_count,created_at")
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1)
    : primaryResult;

  if (queryResult.error) {
    return NextResponse.json({ error: queryResult.error.message }, { status: 500 });
  }

  const data = (queryResult.data ?? []).map((item) => ({
    uploader_name: "uploader_name" in item ? item.uploader_name : null,
    ...item,
  }));
  const paths = data.map((item) => item.storage_path);
  const signedMap = await getSignedPreviewMap(paths);

  const payload = (data ?? []).map((item) => ({
    ...item,
    preview_url: signedMap.get(item.storage_path) ?? null,
  }));

  await cacheSetJson(cacheKey, payload, 20);

  return NextResponse.json(
    { data: payload },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" } },
  );
}
