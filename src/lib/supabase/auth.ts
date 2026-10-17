"use client";

import { useEffect, useState } from "react";
import { supabase } from "./client";
import type { User } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
}

const GUEST_KEY = "sudoku-arena-guest";
const GUEST_USER: AuthUser = {
  id: "guest",
  email: "",
  displayName: "Visitante",
  username: null,
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check if user previously chose guest mode (persists across reloads)
    try {
      if (localStorage.getItem(GUEST_KEY) === "1") {
        setIsGuest(true);
        setUser(GUEST_USER);
        setLoading(false);
        return;
      }
    } catch {
      // localStorage might be unavailable
    }

    // Get initial session — validate against server, not just localStorage cache
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Validate the session against the server (not just localStorage).
        // getUser() makes a network request and will fail if the user was
        // deleted from Supabase, even if their JWT is still in localStorage.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          // User no longer exists — clear the stale session
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        const authUser = toAuthUser(userData.user);
        // Fetch username from profile — if profile doesn't exist, the user
        // was deleted (but auth user might still be around briefly)
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", session.user.id)
          .single();
        if (profile) {
          authUser.username = (profile as Record<string, unknown>).username as string | null;
          authUser.displayName = (profile as Record<string, unknown>).display_name as string;
        } else {
          // Profile missing = user was deleted from the database.
          // Sign out to clear the stale session.
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(authUser);
      }
      setLoading(false);
    }).catch(() => {
      // Network error or Supabase not configured — don't hang forever
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Validate against server on auth state changes too
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", session.user.id)
            .single();
          if (!profile) {
            // Profile missing = user was deleted — sign out
            await supabase.auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }
          const authUser = toAuthUser(session.user);
          authUser.username = (profile as Record<string, unknown>).username as string | null;
          authUser.displayName = (profile as Record<string, unknown>).display_name as string;
          setUser(authUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Login by username OR email — tries username first, then falls back to email
  const signInWithUsernameOrEmail = async (identifier: string, password: string) => {
    const trimmed = identifier.trim();
    let emailToUse = trimmed;

    // If it looks like an email (contains @), use directly
    if (!trimmed.includes("@")) {
      // Try to find email by username via RPC
      try {
        const { data: emailResult, error: rpcError } = await supabase.rpc("get_email_by_username", {
          p_username: trimmed,
        });
        if (!rpcError && emailResult) {
          const result = emailResult as Record<string, unknown>;
          if (result.found && result.email) {
            emailToUse = result.email as string;
          }
        }
      } catch {
        // RPC might not exist yet — fall through to use identifier as email
      }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || username } },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error };
  };

  // Enter guest mode — lets user explore local features without an account
  const enterGuestMode = () => {
    try {
      localStorage.setItem(GUEST_KEY, "1");
    } catch {
      // ignore
    }
    setIsGuest(true);
    setUser(GUEST_USER);
  };

  // Exit guest mode — return to the login screen
  const exitGuestMode = () => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
    setUser(null);
  };

  // Full sign out — clears local session + browser storage
  const signOut = async () => {
    // If in guest mode, just exit guest mode
    if (isGuest) {
      exitGuestMode();
      return;
    }
    // First sync display info to cloud
    if (user) {
      try {
        const { useAppStore } = await import("@/lib/store/app-store");
        const profile = useAppStore.getState().profile;
        await supabase.rpc("update_display_info", {
          p_display_name: profile.displayName,
          p_avatar_seed: profile.avatarSeed,
        });
      } catch {
        // non-critical
      }
    }
    // Sign out from Supabase (this revokes the session)
    await supabase.auth.signOut({ scope: "global" });
    // Force-clear any cached session
    try {
      // Remove all supabase auth tokens from localStorage
      const keys = Object.keys(localStorage).filter((k) => k.includes("sb-") || k.includes("supabase"));
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setUser(null);
  };

  return {
    user,
    loading,
    isGuest,
    signInWithUsernameOrEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    enterGuestMode,
    exitGuestMode,
  };
}

function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email ?? "",
    displayName: (u.user_metadata?.display_name as string) ?? "Player",
    username: null,
  };
}
