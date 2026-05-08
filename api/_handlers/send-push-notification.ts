// Migrated from supabase/functions/send-push-notification/index.ts
// Web Push (RFC8030) sender with VAPID + aes128gcm payload encryption.
// Pure Node port: uses Web Crypto (`globalThis.crypto.subtle`) and `jose` for VAPID JWT.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { SignJWT, importJWK } from 'jose';

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

const subtle = globalThis.crypto.subtle;

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = Buffer.from(base64 + padding, 'base64');
  return new Uint8Array(binary);
}

function uint8ToBase64Url(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
): Promise<string> {
  // VAPID uses ES256 over P-256
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64);
  // Public key uncompressed -> x,y (skip the 0x04 prefix)
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error('VAPID public key must be uncompressed (65 bytes starting with 0x04)');
  }
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: uint8ToBase64Url(privateKeyBytes),
    x: uint8ToBase64Url(x),
    y: uint8ToBase64Url(y),
  };
  const privateKey = await importJWK(jwk, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 86400)
    .sign(privateKey);
  return jwt;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = salt.length ? salt : new Uint8Array(32);
  const key = await subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await subtle.sign('HMAC', key, ikm);
  return new Uint8Array(sig);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const sig = await subtle.sign('HMAC', key, infoWithCounter);
  return new Uint8Array(sig).slice(0, length);
}

function createContext(clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode('P-256');
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

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);
  const localKeyPair = (await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as any; // CryptoKeyPair (DOM type may not be in lib)

  const localPublicKeyRaw = await subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhBase64);
  const clientPublicKey = await subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    localKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);
  const authSecret = base64UrlToUint8Array(authBase64);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  const prk = await hkdfExtract(authSecret, sharedSecret);
  const context = createContext(clientPublicKeyBytes, localPublicKey);
  const contentEncryptionKey = await hkdfExpand(prk, createInfo('aesgcm', context), 16);
  const nonce = await hkdfExpand(prk, createInfo('nonce', context), 12);

  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload[0] = 0;
  paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, 2);

  const cryptoKey = await subtle.importKey(
    'raw',
    contentEncryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, paddedPayload);
  return { encrypted: new Uint8Array(encrypted), salt, localPublicKey };
}

function buildAes128GcmBody(
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  encrypted: Uint8Array,
): Uint8Array {
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
  return body;
}

async function sendWebPush(
  subscription: Subscription,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const payloadString = JSON.stringify(payload);
    const jwt = await createVapidJwt(
      url.origin,
      'mailto:contato@kaleidos.cc',
      vapidPrivateKey,
      vapidPublicKey,
    );
    const { encrypted, salt, localPublicKey } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth,
    );
    const body = buildAes128GcmBody(salt, localPublicKey, encrypted);
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
    });

    if (response.status >= 200 && response.status < 300) {
      console.log('[send-push] ok:', subscription.endpoint.substring(0, 50));
      return true;
    }
    console.error('[send-push] failed:', response.status);
    return response.status !== 404 && response.status !== 410;
  } catch (error) {
    console.error('[send-push] error sending push:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const { userId, workspaceId, payload } = body as {
      userId?: string;
      workspaceId?: string;
      payload: PushPayload;
    };

    if (!userId && !workspaceId) {
      throw new Error('userId or workspaceId required');
    }
    if (!payload || !payload.title) {
      throw new Error('payload.title is required');
    }

    const subscriptions = userId
      ? await query<any>(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
          [userId],
        )
      : await query<any>(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE workspace_id = $1`,
          [workspaceId],
        );

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] no subscriptions for user/workspace');
      return res.status(200).json({ success: true, sent: 0, message: 'No subscriptions' });
    }

    console.log(`[send-push] ${subscriptions.length} subscription(s)`);

    const results = await Promise.all(
      subscriptions.map(async (sub: any) => {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
        );
        if (!success) {
          await getPool()
            .query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id])
            .catch(() => null);
          console.log('[send-push] removed expired subscription:', sub.id);
        }
        return success;
      }),
    );
    const successCount = results.filter(Boolean).length;
    console.log(`[send-push] sent: ${successCount}/${subscriptions.length}`);
    return res.status(200).json({
      success: true,
      sent: successCount,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('[send-push] error:', error);
    return jsonError(res, 500, error?.message || 'Unknown error');
  }
}
