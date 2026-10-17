"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Whether Supabase env vars are actually configured (not placeholder)
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return createClient("https://placeholder.supabase.co", "placeholder", {
      auth: { persistSession: false },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

// Singleton — initialized lazily on first access in the browser
let _client: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_client) _client = createSupabaseClient();
    const value = (_client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_client);
    }
    // For nested objects (like .auth), return the actual object — methods on it
    // are already bound to the correct `this` by the Supabase SDK
    return value;
  },
});

export type SupabaseClientType = SupabaseClient;
