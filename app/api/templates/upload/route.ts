import { z } from "zod";
import { NextResponse } from "next/server";
import { cacheDelPrefix } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";
import { getServiceSupabase } from "@/lib/supabase";
import { buildStoragePath, getClientIp, hashIp, normalizeTags } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  tags: z.string().trim().max(240).optional(),
  uploaderName: z.string().trim().max(40).optional(),
});

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const rate = await enforceRateLimit(`upload:${ip ?? "unknown"}`);
  if (!rate.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds max size" }, { status: 400 });
  }

  const parsed = schema.safeParse({
    title: formData.get("title"),
    tags: formData.get("tags") ?? "",
    uploaderName: formData.get("uploaderName") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const storagePath = buildStoragePath(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const env = getEnv();

  const uploadResult = await supabase.storage
    .from(env.uploadBucket)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const tags = normalizeTags(parsed.data.tags ?? "");
  const baseInsert = {
    title: parsed.data.title,
    storage_path: storagePath,
    mime_type: file.type,
    tags,
    uploader_ip_hash: hashIp(ip),
  };

  let result = await supabase
    .from("meme_templates")
    .insert({
      ...baseInsert,
      uploader_name: parsed.data.uploaderName || null,
    })
    .select("id")
    .single();

  // Backward-compatible fallback if DB hasn't added uploader_name yet.
  if (result.error?.message.includes("uploader_name")) {
    result = await supabase.from("meme_templates").insert(baseInsert).select("id").single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  await Promise.all([
    cacheDelPrefix("feed:recent:v4:"),
    cacheDelPrefix("search:v3:"),
    cacheDelPrefix("tags:list:v1"),
  ]);

  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
