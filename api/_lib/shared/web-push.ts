// Shared Web Push (RFC8030) helper — VAPID JWT + aes128gcm payload encryption.
// Extracted from send-push-notification handler so process-push-queue can reuse.
// Pure Node (uses globalThis.crypto.subtle + jose). No external deps beyond `jose`.
import { SignJWT, importJWK } from 'jose';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

const subtle = globalThis.crypto.subtle;

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = Buffer.from(base64 + padding, 'base64');
  return new Uint8Array(binary);
}

function uint8ToBase64Url(arr: Uint8Array): string {
  return Buffer.from(arr)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const privateKeyBytes = base64UrlToUint8Array(privateKeyBase64);
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64);
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
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 86400)
    .sign(privateKey);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = salt.length ? salt : new Uint8Array(32);
  const key = await subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await subtle.sign('HMAC', key, ikm);
  return new Uint8Array(sig);
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
  authBase64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const payloadBytes = new TextEncoder().encode(payload);
  const localKeyPair = (await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )) as any;

  const localPublicKeyRaw = await subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKey = new Uint8Array(localPublicKeyRaw);

  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhBase64);
  const clientPublicKey = await subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    localKeyPair.privateKey,
    256
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
    ['encrypt']
  );
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    paddedPayload
  );
  return { encrypted: new Uint8Array(encrypted), salt, localPublicKey };
}

function buildAes128GcmBody(
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  encrypted: Uint8Array
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

/**
 * Send a Web Push notification using VAPID + aes128gcm.
 * Returns { success: boolean, statusCode, error } so callers can detect 404/410
 * (expired subscriptions) and prune them.
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload | string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject = 'mailto:contato@kaleidos.cc'
): Promise<SendResult> {
  try {
    const url = new URL(subscription.endpoint);
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const jwt = await createVapidJwt(
      url.origin,
      vapidSubject,
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
      return { success: true, statusCode: response.status };
    }
    const errorText = await response.text().catch(() => '');
    return { success: false, statusCode: response.status, error: errorText };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
