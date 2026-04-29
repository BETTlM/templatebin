function getFirstSet(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return null;
}

export function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = getFirstSet([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
  const supabaseSecretKey = getFirstSet([
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  if (!supabaseUrl) {
    throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabasePublishableKey) {
    throw new Error(
      "Missing env var: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  if (!supabaseSecretKey) {
    throw new Error(
      "Missing env var: set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseSecretKey,
    uploadBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "meme-templates",
    ipSalt: process.env.IP_HASH_SALT ?? "change-me",
  };
}
