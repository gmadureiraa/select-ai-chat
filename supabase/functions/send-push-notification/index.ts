import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as jose from "https://deno.land/x/jose@v5.2.2/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Base64URL decoding
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Create PKCS8 format from raw ECDSA key
function createPkcs8FromRaw(privateKeyRaw: Uint8Array, publicKeyRaw: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20
  ]);
  
  const publicKeyWrapper = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);
  const result = new Uint8Array(header.length + privateKeyRaw.length + publicKeyWrapper.length + publicKeyRaw.length);
  result.set(header, 0);
  result.set(privateKeyRaw, header.length);
  result.set(publicKeyWrapper, header.length + privateKeyRaw.length);
  result.set(publicKeyRaw, header.length + privateKeyRaw.length + publicKeyWrapper.length);
  
  return result.buffer as ArrayBuffer;
}

// Create VAPID JWT
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64);
  const pkcs8 = createPkcs8FromRaw(privateKeyBytes, publicKeyBytes);
  
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 86400)
    .sign(privateKey);

  return jwt;
}

// Encrypt payload
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);
  
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);
  
  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhBase64);
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  const authSecret = base64UrlToUint8Array(authBase64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const prk = await hkdfExtract(authSecret, sharedSecret);
  const context = createContext(clientPublicKeyBytes, localPublicKey);
  const contentEncryptionKey = await hkdfExpand(prk, createInfo("aesgcm", context), 16);
  const nonce = await hkdfExpand(prk, createInfo("nonce", context), 12);
  
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload[0] = 0;
  paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, 2);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
    cryptoKey,
    paddedPayload.buffer as ArrayBuffer
  );
  
  return { encrypted: new Uint8Array(encrypted), salt, localPublicKey };
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = salt.length ? salt.buffer as ArrayBuffer : new Uint8Array(32).buffer as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, ikm.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    prk.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const signature = await crypto.subtle.sign("HMAC", key, infoWithCounter.buffer as ArrayBuffer);
  return new Uint8Array(signature).slice(0, length);
}

function createContext(clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode("P-256");
  const context = new Uint8Array(5 + label.length + 65 + 65);
  let offset = 0;
  context.set(label, offset);
  offset += label.length;
  context[offset++] = 0;
  context[offset++] = 0;
  context[offset++] = 65;
  context.set(clientPublicKey, offset);
  offset += 65;
  context[offset++] = 0;
  context[offset++] = 65;
  context.set(serverPublicKey, offset);
  return context;
}

function createInfo(type: string, context: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode(`Content-Encoding: ${type}\0`);
  const info = new Uint8Array(label.length + context.length);
  info.set(label);
  info.set(context, label.length);
  return info;
}

function buildAes128GcmBody(
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  encrypted: Uint8Array
): ArrayBuffer {
  const rs = 4096;
  const body = new Uint8Array(16 + 4 + 1 + 65 + encrypted.length);
  let offset = 0;
  body.set(salt, offset);
  offset += 16;
  body[offset++] = (rs >> 24) & 0xff;
  body[offset++] = (rs >> 16) & 0xff;
  body[offset++] = (rs >> 8) & 0xff;
  body[offset++] = rs & 0xff;
  body[offset++] = 65;
  body.set(localPublicKey, offset);
  offset += 65;
  body.set(encrypted, offset);
  return body.buffer as ArrayBuffer;
}

async function sendWebPush(
  subscription: Subscription,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const payloadString = JSON.stringify(payload);
    
    const jwt = await createVapidJwt(
      url.origin,
      "mailto:contato@kaleidos.cc",
      vapidPrivateKey,
      vapidPublicKey
    );
    
    const { encrypted, salt, localPublicKey } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );
    
    const body = buildAes128GcmBody(salt, localPublicKey, encrypted);
    
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Urgency": "normal",
      },
      body,
    });
    
    if (response.status >= 200 && response.status < 300) {
      console.log("[send-push] Push sent successfully to:", subscription.endpoint.substring(0, 50));
      return true;
    }
    
    console.error("[send-push] Push failed:", response.status);
    return response.status !== 404 && response.status !== 410;
  } catch (error) {
    console.error("[send-push] Error sending push:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { userId, workspaceId, payload } = await req.json();
    
    console.log("[send-push] Sending push to user:", userId);

    let query = supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    
    if (userId) {
      query = query.eq("user_id", userId);
    } else if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    } else {
      throw new Error("userId or workspaceId required");
    }
    
    const { data: subscriptions, error: subError } = await query;
    
    if (subError) {
      console.error("[send-push] Error fetching subscriptions:", subError);
      throw subError;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-push] No subscriptions found for user");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[send-push] Found", subscriptions.length, "subscription(s)");
    
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        
        if (!success) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          console.log("[send-push] Removed expired subscription:", sub.id);
        }
        
        return success;
      })
    );
    
    const successCount = results.filter(Boolean).length;
    console.log("[send-push] Sent:", successCount, "/", subscriptions.length);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-push] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
