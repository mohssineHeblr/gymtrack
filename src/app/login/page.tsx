"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { Button, Field, Input, PageHeader, Segmented } from "@/components/ui";
import { signIn, signUp, useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useGym } from "@/lib/store";
import { syncNow } from "@/lib/sync";

export default function LoginPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const onboarded = useGym((s) => s.onboarded);
  const completeOnboarding = useGym((s) => s.completeOnboarding);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const done = async () => {
    if (!onboarded) completeOnboarding(useGym.getState().profile.name || "Athlete", useGym.getState().profile.units);
    useGym.getState().setSync({ lastSyncedAt: null });
    // wait for auth store to update, then sync
    setTimeout(() => void syncNow(), 300);
    router.replace("/");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        await done();
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo("Check your email to confirm your account, then sign in.");
          setMode("signin");
        } else await done();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="" back large={false} />
      <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-ink">
        <Dumbbell className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
      <p className="mt-1 text-center text-sm text-muted">Back up and sync your training across devices.</p>

      {!isSupabaseConfigured ? (
        <div className="mt-8 rounded-3xl border border-line bg-surface p-5 text-sm text-muted">
          Cloud accounts aren&apos;t configured for this installation. GYMTRACK works fully in local mode — your data is saved on this device.
          <br />
          <br />
          To enable sign-in, add <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see README).
        </div>
      ) : user ? (
        <div className="mt-8 space-y-3 text-center">
          <p className="text-sm">
            Signed in as <b>{user.email}</b>
          </p>
          <Button className="w-full" onClick={() => router.replace("/")}>Continue</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Sign up" },
            ]}
          />
          <Field label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          {info && <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">{info}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted">Your existing local data will be uploaded to your account.</p>
        </form>
      )}
    </div>
  );
}
