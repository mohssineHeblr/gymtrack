"use client";

/**
 * Rest-timer notifications.
 *
 * 1. Local notification — shown by the service worker when the countdown ends while the page is
 *    hidden but still running (Android Chrome, desktop browsers).
 * 2. Web Push fallback — iOS (and Android when the browser freezes the tab) suspends JavaScript in
 *    the background, so no local timer can fire. When enabled, the app asks a Supabase Edge Function
 *    to send a push at the end time. The push is cancelled as soon as the app is visible again.
 *    Push notifications use the system notification sound — a custom ringtone is not possible.
 */

import { getSupabase, isSupabaseConfigured } from "./supabase";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

export const notificationPermission = (): NotificationPermission | "unsupported" =>
  notificationsSupported() ? Notification.permission : "unsupported";

/** Must be called from a user gesture (iOS requires the PWA to be installed to the Home Screen). */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showRestNotification(body = "Rest is over — time for your next set.") {
  if (notificationPermission() !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const opts: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
      body,
      tag: "rest-timer",
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [250, 120, 250],
      data: { url: "/workout" },
    };
    if (reg) await reg.showNotification("GYMTRACK · Rest finished", opts);
    else new Notification("GYMTRACK · Rest finished", opts);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Web Push fallback
// ---------------------------------------------------------------------------

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const FN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rest-timer-push` : "";

export const pushConfigured = () =>
  Boolean(VAPID_PUBLIC && isSupabaseConfigured && typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator);

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

let subscription: PushSubscriptionJSON | null = null;
let token: string | null = null;
let scheduledId: string | null = null;

/** Subscribe this device for push (call from a user gesture after permission is granted). */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!pushConfigured() || notificationPermission() !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    subscription = sub.toJSON();
    await refreshToken();
    return true;
  } catch (e) {
    console.warn("[push] subscribe failed", e);
    return false;
  }
}

/** Cache the access token so scheduling can happen synchronously when the page is being hidden. */
export async function refreshToken() {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  token = data.session?.access_token ?? null;
}

function send(body: Record<string, unknown>) {
  if (!FN_URL || !token) return;
  try {
    void fetch(FN_URL, {
      method: "POST",
      keepalive: true, // lets the request finish while the page is being suspended
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Ask the server to push a notification at `endsAt` (epoch ms). Replaces any previous schedule. */
export function scheduleRestPush(endsAt: number) {
  if (!subscription?.endpoint || !token || endsAt - Date.now() < 3000) return;
  cancelRestPush();
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  scheduledId = id;
  send({ action: "schedule", id, fireAt: new Date(endsAt).toISOString(), endpoint: subscription.endpoint });
}

export function cancelRestPush() {
  if (!scheduledId) return;
  send({ action: "cancel", id: scheduledId });
  scheduledId = null;
}
