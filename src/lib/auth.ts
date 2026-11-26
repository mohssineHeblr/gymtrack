"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

interface AuthState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
}));

let initialized = false;

export function initAuth() {
  if (initialized) return;
  initialized = true;
  const sb = getSupabase();
  if (!sb) {
    useAuth.getState().setUser(null);
    return;
  }
  sb.auth.getSession().then(({ data }) => useAuth.getState().setUser(data.session?.user ?? null));
  sb.auth.onAuthStateChange((_e, session) => useAuth.getState().setUser(session?.user ?? null));
}

export async function signIn(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync is not configured.");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync is not configured.");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
