"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
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

/**
 * Build an AuthUser object from a Supabase User, enriching it with
 * profile data (username, display_name) fetched from the profiles table.
 */
async function buildAuthUser(u: User): Promise<AuthUser> {
  const authUser: AuthUser = {
    id: u.id,
    email: u.email ?? "",
    displayName: (u.user_metadata?.display_name as string) ?? "Player",
    username: null,
  };
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", u.id)
    .single();
  if (profile) {
    const p = profile as Record<string, unknown>;
    authUser.username = (p.username as string | null) ?? null;
    authUser.displayName = (p.display_name as string) ?? authUser.displayName;
  }
  return authUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isGuest: boolean;
  signInWithUsernameOrEmail: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, displayName: string, username: string) => Promise<{ data: unknown; error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy-initialize guest state from localStorage so we don't need to
  // call setState synchronously inside the effect (avoids cascading
  // renders and the react-hooks/set-state-in-effect lint rule).
  const [initialGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<AuthUser | null>(initialGuest ? GUEST_USER : null);
  const [loading, setLoading] = useState(!initialGuest);
  const [isGuest, setIsGuest] = useState(initialGuest);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    // 1. Always subscribe to auth state changes — this is the only
    //    reliable way to know when signInWithPassword succeeds after
    //    the user exited guest mode. The subscription is active even
    //    when starting in guest mode.
    const { data } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        // When a real session arrives, clear any guest flag and set the user.
        if (session?.user) {
          try {
            localStorage.removeItem(GUEST_KEY);
          } catch {
            // ignore
          }
          setIsGuest(false);
          // Validate against server: if the profile is missing the user
          // was deleted from the database → sign out.
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", session.user.id)
            .single();
          if (!profile) {
            await supabase.auth.signOut({ scope: "local" });
            setUser(null);
            setLoading(false);
            return;
          }
          const authUser = await buildAuthUser(session.user);
          setUser(authUser);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
        setLoading(false);
      },
    );
    subscription = data.subscription;

    // 2. If starting in guest mode, nothing else to do — the lazy
    //    initializers already set user/loading/isGuest. The subscription
    //    above will take over when the user signs in for real.
    if (initialGuest) {
      return () => {
        cancelled = true;
        subscription?.unsubscribe();
      };
    }

    // 3. Not in guest mode — fetch the initial session, validating it
    //    against the server (getUser) so deleted users are signed out.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        // getUser() makes a network request and will fail if the user was
        // deleted from Supabase, even if their JWT is still in localStorage.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          await supabase.auth.signOut({ scope: "local" });
          setUser(null);
          setLoading(false);
          return;
        }
        // Profile lookup — missing profile means the user was deleted
        // from the database. Sign out to clear the stale session.
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", session.user.id)
          .single();
        if (!profile) {
          await supabase.auth.signOut({ scope: "local" });
          setUser(null);
          setLoading(false);
          return;
        }
        const authUser = await buildAuthUser(userData.user);
        if (!cancelled) setUser(authUser);
      }
      if (!cancelled) setLoading(false);
    }).catch(() => {
      // Network error or Supabase not configured — don't hang forever
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [initialGuest]);

  // Login by username OR email — tries username first, then falls back to email.
  const signInWithUsernameOrEmail = useCallback(async (identifier: string, password: string) => {
    const trimmed = identifier.trim();
    let emailToUse = trimmed;

    // If it looks like an email (contains @), use directly
    if (!trimmed.includes("@")) {
      // Try to find email by username via RPC.
      // NOTE: this RPC is anon-accessible and returns the user's email.
      // This is an accepted trade-off for username-based login: an
      // attacker can enumerate which usernames exist and learn their
      // emails. Mitigation: rely on Supabase rate limiting + password
      // hashing. Removing this would break username login entirely.
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
    return { error: error as Error | null };
  }, []);

  // Sign up with email + password. display_name and username are passed
  // as user_metadata so the handle_new_user trigger / set_username RPC
  // can pick them up. emailRedirectTo ensures the confirmation email
  // (if enabled) points back to the app.
  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || username, username },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { data, error: error as Error | null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        queryParams: { prompt: "select_account" },
      },
    });
    return { error: error as Error | null };
  }, []);

  // Request a password reset email. Supabase sends an email with a link
  // that redirects to the site with a recovery token in the hash.
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/#reset` : undefined,
    });
    return { error: error as Error | null };
  }, []);

  // Enter guest mode — lets user explore local features without an account.
  // Because this is a Context, the state change propagates to ALL
  // consumers (AppShell, AuthDialog, views, etc.) simultaneously.
  const enterGuestMode = useCallback(() => {
    try {
      localStorage.setItem(GUEST_KEY, "1");
    } catch {
      // ignore
    }
    setIsGuest(true);
    setUser(GUEST_USER);
    setLoading(false);
  }, []);

  // Exit guest mode — return to the login screen. We DO NOT call
  // getSession here: the onAuthStateChange subscription (always active)
  // will pick up any real session once the user signs in. We just clear
  // the guest flag so the AuthDialog re-renders.
  const exitGuestMode = useCallback(() => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
    setUser(null);
    setLoading(false);
  }, []);

  // Sign out. Uses scope "local" so only this device's session is
  // revoked — the user's other devices stay logged in (standard UX).
  const signOut = useCallback(async () => {
    // If in guest mode, just exit guest mode (no server session to clear)
    if (isGuest) {
      exitGuestMode();
      return;
    }
    // Sign out from Supabase (revokes the local session only)
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore — proceed to clear local state anyway
    }
    // Force-clear any cached session tokens from localStorage
    try {
      const keys = Object.keys(localStorage).filter((k) => k.includes("sb-") || k.includes("supabase"));
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setUser(null);
  }, [isGuest, exitGuestMode]);

  const value: AuthContextValue = {
    user,
    loading,
    isGuest,
    signInWithUsernameOrEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
    signOut,
    enterGuestMode,
    exitGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — consume the auth context.
 * Must be used inside <AuthProvider>. All consumers share the SAME
 * auth state (single source of truth), so enterGuestMode / signOut /
 * login called from any component immediately reflect everywhere.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
