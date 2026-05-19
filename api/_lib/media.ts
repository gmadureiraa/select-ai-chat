type JsonRecord = Record<string, unknown>;

export type PublishMediaItem = { type: string; url: string; order?: number };

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringOpt(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function mediaTypeFrom(url: string, explicit?: string, mimeType?: string): string {
  if (explicit === 'video' || explicit === 'image' || explicit === 'document' || explicit === 'audio') {
    return explicit;
  }
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split('?')[0];
  }
  if (/\.(mp4|mov|webm|avi|m4v)$/i.test(pathname)) return 'video';
  if (/\.(mp3|wav|m4a|aac)$/i.test(pathname)) return 'audio';
  if (/\.pdf$/i.test(pathname)) return 'document';
  return 'image';
}

function mirrorMap(metadata: unknown): Map<string, string> {
  const mirrors = asRecord(metadata).media_mirrors;
  const map = new Map<string, string>();
  if (!Array.isArray(mirrors)) return map;
  for (const raw of mirrors) {
    const mirror = asRecord(raw);
    if (mirror.status !== 'ok') continue;
    const originalUrl = stringOpt(mirror, 'originalUrl');
    const r2Url = stringOpt(mirror, 'r2Url');
    if (originalUrl && r2Url) map.set(originalUrl, r2Url);
  }
  return map;
}

export function resolveMediaUrl(url: string, metadata?: unknown): string {
  return mirrorMap(metadata).get(url) || url;
}

export function buildPublishMediaItems(args: {
  mediaUrls?: string[];
  mediaItems?: Array<{ type?: string; url: string; mimeType?: string }>;
  metadata?: unknown;
}): PublishMediaItem[] {
  const mirrors = mirrorMap(args.metadata);
  if (args.mediaItems && args.mediaItems.length > 0) {
    return args.mediaItems
      .filter((item) => typeof item.url === 'string' && item.url.trim())
      .map((item, i) => {
        const url = mirrors.get(item.url) || item.url;
        return {
          type: mediaTypeFrom(url, item.type, item.mimeType),
          url,
          order: i,
        };
      });
  }

  return (args.mediaUrls || [])
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map((url, i) => {
      const resolvedUrl = mirrors.get(url) || url;
      return {
        type: mediaTypeFrom(resolvedUrl),
        url: resolvedUrl,
        order: i,
      };
    });
}
