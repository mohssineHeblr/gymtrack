// Supabase Edge Function: rest-timer Web Push fallback.
//
// iOS / Android suspend web apps in the background, so the in-app timer can't sound an alarm
// while the phone is locked. When the app is hidden it calls this function with the end time;
// the function waits and sends a Web Push, unless the client cancelled it in the meantime.
//
// The push carries no payload (no encryption needed); the service worker shows a generic
// "Rest finished" notification with the system sound. Custom ringtones are not possible.
//
// Deploy:  npx supabase functions deploy rest-timer-push
// Secrets: npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// (SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

/** Max time one invocation waits before handing over to a fresh invocation */
const MAX_WAIT_MS = 110_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- VAPID ----
const b64urlToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};
const bytesToB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let signingKey: CryptoKey | null = null;
async function getSigningKey() {
  if (signingKey) return signingKey;
  const pub = b64urlToBytes(VAPID_PUBLIC); // 65 bytes: 0x04 || x || y
  const jwk = { kty: "EC", crv: "P-256", d: VAPID_PRIVATE, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true };
  signingKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return signingKey;
}

async function vapidJwt(audience: string) {
  const enc = (o: unknown) => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await getSigningKey(), new TextEncoder().encode(unsigned)));
  return `${unsigned}.${bytesToB64url(sig)}`;
}

async function sendPush(endpoint: string) {
  const jwt = await vapidJwt(new URL(endpoint).origin);
  return fetch(endpoint, {
    method: "POST",
    headers: { TTL: "120", Urgency: "high", Topic: "rest-timer", Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`, "Content-Length": "0" },
  });
}

// ------------------------------------------------------------ scheduling ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitAndSend(id: string) {
  for (;;) {
    const { data: row } = await admin.from("rest_timer_pushes").select("*").eq("id", id).maybeSingle();
    if (!row || row.cancelled || row.sent_at) return;
    const wait = new Date(row.fire_at).getTime() - Date.now();
    if (wait > MAX_WAIT_MS) {
      // Stay within the function's wall-clock limit: wait a bit, then continue in a new invocation.
      await sleep(MAX_WAIT_MS - 5_000);
      await fetch(`${SUPABASE_URL}/functions/v1/rest-timer-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", id }),
      });
      return;
    }
    if (wait > 0) {
      await sleep(wait);
      continue; // re-check for cancellation right before sending
    }
    const res = await sendPush(row.endpoint);
    await admin.from("rest_timer_pushes").update({ sent_at: new Date().toISOString() }).eq("id", id);
    if (!res.ok) console.warn("push failed", res.status, await res.text().catch(() => ""));
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "VAPID keys not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const { action, id } = body as { action?: string; id?: string; fireAt?: string; endpoint?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid id" }, 400);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

  // Internal hand-over from a previous invocation
  if (action === "continue") {
    if (token !== SERVICE) return json({ error: "forbidden" }, 403);
    EdgeRuntime.waitUntil(waitAndSend(id));
    return json({ ok: true });
  }

  // Everything else requires a signed-in user
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await userClient.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  if (action === "cancel") {
    // Insert a tombstone first so a cancel that arrives before its schedule still wins,
    // then cancel the row — only ever touching rows owned by this user.
    await admin.from("rest_timer_pushes").upsert({ id, user_id: user.id, cancelled: true }, { onConflict: "id", ignoreDuplicates: true });
    await admin.from("rest_timer_pushes").update({ cancelled: true }).eq("id", id).eq("user_id", user.id);
    return json({ ok: true });
  }

  if (action === "schedule") {
    const fireAt = new Date(String(body.fireAt ?? ""));
    const endpoint = String(body.endpoint ?? "");
    const delay = fireAt.getTime() - Date.now();
    if (Number.isNaN(delay) || delay < 0 || delay > 2 * 3600_000) return json({ error: "invalid fireAt" }, 400);
    if (!/^https:\/\//.test(endpoint)) return json({ error: "invalid endpoint" }, 400);
    // ignoreDuplicates: if a cancel for this id already arrived, keep it cancelled
    await admin
      .from("rest_timer_pushes")
      .upsert({ id, user_id: user.id, endpoint, fire_at: fireAt.toISOString() }, { onConflict: "id", ignoreDuplicates: true });
    EdgeRuntime.waitUntil(waitAndSend(id));
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
