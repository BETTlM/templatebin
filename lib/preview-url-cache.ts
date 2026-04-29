import { cacheGetJson, cacheSetJson } from "@/lib/cache";
import { getEnv } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";

function previewKey(path: string) {
  return `preview:url:v1:${path}`;
}

export async function getSignedPreviewMap(storagePaths: string[]) {
  const uniquePaths = Array.from(new Set(storagePaths.filter(Boolean)));
  const signedMap = new Map<string, string>();
  if (!uniquePaths.length) return signedMap;

  const env = getEnv();
  const supabase = getServiceSupabase();

  // Public buckets are much faster: stable CDN URLs and no signing roundtrip.
  if (env.isPublicBucket) {
    uniquePaths.forEach((path) => {
      const { data } = supabase.storage.from(env.uploadBucket).getPublicUrl(path);
      if (data.publicUrl) {
        signedMap.set(path, data.publicUrl);
      }
    });
    return signedMap;
  }

  const cacheHits = await Promise.all(
    uniquePaths.map(async (path) => ({
      path,
      url: await cacheGetJson<string>(previewKey(path)),
    })),
  );

  const misses = cacheHits.filter((item) => !item.url).map((item) => item.path);
  cacheHits.forEach((hit) => {
    if (hit.url) signedMap.set(hit.path, hit.url);
  });

  if (!misses.length) return signedMap;

  const signed = await supabase.storage.from(env.uploadBucket).createSignedUrls(misses, 60 * 30);

  (signed.data ?? []).forEach((entry, index) => {
    const path = misses[index];
    if (!entry?.signedUrl || !path) return;
    signedMap.set(path, entry.signedUrl);
  });

  await Promise.all(
    misses.map(async (path) => {
      const url = signedMap.get(path);
      if (!url) return;
      await cacheSetJson(previewKey(path), url, 60 * 20);
    }),
  );

  return signedMap;
}
