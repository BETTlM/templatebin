import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

function sanitizeFilename(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "template";
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = getServiceSupabase();
  const { data: template, error } = await supabase
    .from("meme_templates")
    .select("id,title,storage_path,mime_type")
    .eq("id", params.id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Keep download path fast; count update happens in background.
  void supabase.rpc("increment_download_count", {
    template_id: params.id,
  });

  const fileResult = await supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET ?? "meme-templates").download(template.storage_path);

  if (fileResult.error || !fileResult.data) {
    return NextResponse.json({ error: fileResult.error?.message ?? "Could not download file" }, { status: 500 });
  }

  const arrayBuffer = await fileResult.data.arrayBuffer();
  const ext = extensionFromMime(template.mime_type ?? "image/jpeg");
  const fileName = `${sanitizeFilename(template.title ?? "template")}.${ext}`;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": template.mime_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
