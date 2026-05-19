/**
 * Cloudflare R2 storage helper para uploads do KAI.
 *
 * Substitui Vercel Blob (suspenso em 2026-05-19 por estourar quota 100MB free).
 * Mesma estratégia validada no biblioteca-viral em 2026-05-18:
 *   - 10GB free, zero egress
 *   - Compatível com S3 API via @aws-sdk/client-s3
 *   - URLs públicas via subdomínio r2.dev quando "Public Access" habilitado
 *
 * Env vars (server-side):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET            (kai-app)
 *   R2_PUBLIC_URL        (https://pub-XXX.r2.dev — sem trailing slash)
 */
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient: { s3: S3Client; bucket: string; publicBase: string } | null =
  null;

export function getR2(): {
  s3: S3Client;
  bucket: string;
  publicBase: string;
} {
  if (cachedClient) return cachedClient;

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  } = process.env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_URL
  ) {
    throw new Error(
      "R2 não configurado — falta R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_URL no env.",
    );
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  cachedClient = {
    s3,
    bucket: R2_BUCKET,
    publicBase: R2_PUBLIC_URL.replace(/\/$/, ""),
  };
  return cachedClient;
}

/** URL pública assumindo Public Access habilitado no bucket. */
export function publicUrl(key: string): string {
  const { publicBase } = getR2();
  return `${publicBase}/${key.replace(/^\/+/, "")}`;
}

/** Upload buffer pro R2. Retorna URL pública. */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
): Promise<{ url: string; key: string; size: number }> {
  const { s3, bucket } = getR2();
  const cleanKey = key.replace(/^\/+/, "");
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  return { url: publicUrl(cleanKey), key: cleanKey, size: body.length };
}

/** Presigned PUT URL para upload direto do browser ao R2. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresInSec = 900,
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
  headers: Record<string, string>;
}> {
  const { s3, bucket } = getR2();
  const cleanKey = key.replace(/^\/+/, "");
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
    ContentType: contentType,
  });
  return {
    uploadUrl: await getSignedUrl(s3, cmd, { expiresIn: expiresInSec }),
    publicUrl: publicUrl(cleanKey),
    key: cleanKey,
    expiresIn: expiresInSec,
    headers: {
      "Content-Type": contentType,
    },
  };
}

export async function objectExists(key: string): Promise<boolean> {
  const { s3, bucket } = getR2();
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key.replace(/^\/+/, "") }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { s3, bucket } = getR2();
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k.replace(/^\/+/, "") })),
      },
    }),
  );
}

export async function listObjects(prefix: string, limit = 100) {
  const { s3, bucket } = getR2();
  const r = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix.replace(/^\/+/, ""),
      MaxKeys: limit,
    }),
  );
  return (r.Contents ?? []).map((o) => ({
    name: o.Key ?? "",
    size: o.Size ?? 0,
    lastModified: o.LastModified?.toISOString() ?? null,
  }));
}

/** Presigned GET URL (pra download privado via proxy /api/blob/download). */
export async function presignGet(
  key: string,
  expiresInSec = 3600,
): Promise<string> {
  const { s3, bucket } = getR2();
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key.replace(/^\/+/, ""),
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

/** Sanitiza segmento de path pra usar como key R2 (alfanumérico + - _). */
export function sanitizeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}
