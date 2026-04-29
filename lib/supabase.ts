import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function getServiceSupabase() {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getPublicSupabase() {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.supabasePublishableKey);
}
