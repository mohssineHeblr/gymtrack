// Generates a VAPID key pair for the rest-timer Web Push fallback.
// Usage: npm run vapid
import { webcrypto as crypto } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const raw = await crypto.subtle.exportKey("raw", publicKey);
const jwk = await crypto.subtle.exportKey("jwk", privateKey);

console.log(`# Add to .env.local (public key is safe to expose):
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${b64url(raw)}

# Add as Supabase Edge Function secrets (keep the private key secret!):
#   npx supabase secrets set VAPID_PUBLIC_KEY=${b64url(raw)} VAPID_PRIVATE_KEY=${jwk.d} VAPID_SUBJECT=mailto:you@example.com
`);
