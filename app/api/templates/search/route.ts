import { NextResponse } from "next/server";
import { cacheGetJson, cacheSetJson } from "@/lib/cache";
import { getSignedPreviewMap } from "@/lib/preview-url-cache";
import { searchTemplates } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const force = searchParams.get("force") === "1";
  const tags = (searchParams.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const cacheKey = `search:v3:${query.trim().toLowerCase()}::${tags.join(",")}`;

  if (!force) {
    const cached = await cacheGetJson<unknown[]>(cacheKey);
    if (cached) {
      return NextResponse.json(
        { data: cached },
        { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=90" } },
      );
    }
  }

  const data = await searchTemplates(query, tags, 30);
  const paths = data.map((item) => item.storage_path);
  const signedMap = await getSignedPreviewMap(paths);

  const payload = data.map((item) => ({
      ...item,
      uploader_name: item.uploader_name ?? null,
      preview_url: signedMap.get(item.storage_path) ?? null,
    }));
  await cacheSetJson(cacheKey, payload, 15);

  return NextResponse.json(
    { data: payload },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=90" } },
  );
}
