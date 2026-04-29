import { getServiceSupabase } from "@/lib/supabase";
import type { MemeTemplate } from "@/lib/types";

export function sanitizeQuery(query: string): string {
  return query.trim().slice(0, 80);
}

export async function searchTemplates(query: string, tags: string[], limit = 24) {
  const supabase = getServiceSupabase();
  const cleaned = sanitizeQuery(query);

  const { data, error } = await supabase.rpc("search_meme_templates", {
    search_query: cleaned,
    tag_filter: tags.length ? tags : null,
    result_limit: Math.min(limit, 50),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MemeTemplate[];
}
