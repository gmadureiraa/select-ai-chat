export type PlanningMediaType = 'image' | 'video' | 'document' | 'audio' | 'file';

export interface PlanningMediaItem {
  id: string;
  url: string;
  type: PlanningMediaType;
  path?: string;
  mimeType?: string;
  size?: number;
  name?: string;
  source?: 'r2' | 'legacy' | 'generated' | 'external';
  fallbackUrl?: string;
}

export interface PlanningMediaMirror {
  originalUrl: string;
  r2Url?: string;
  key?: string;
  contentType?: string;
  size?: number;
  copiedAt?: string;
  status: 'ok' | 'pending' | 'failed';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function inferPlanningMediaType(
  value: { url?: string; mimeType?: string; type?: string },
): PlanningMediaType {
  const explicit = value.type;
  if (
    explicit === 'image' ||
    explicit === 'video' ||
    explicit === 'document' ||
    explicit === 'audio' ||
    explicit === 'file'
  ) {
    return explicit;
  }

  const mime = value.mimeType?.toLowerCase() || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';

  let pathname = value.url || '';
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    pathname = pathname.split('?')[0];
  }
  const ext = pathname.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['pdf'].includes(ext)) return 'document';
  return 'file';
}

export function getPlanningMediaMirrors(metadata: unknown): PlanningMediaMirror[] {
  const mirrors = asRecord(metadata).media_mirrors;
  if (!Array.isArray(mirrors)) return [];
  return mirrors
    .map((mirror) => {
      const record = asRecord(mirror);
      const originalUrl = stringValue(record.originalUrl);
      if (!originalUrl) return null;
      return {
        originalUrl,
        r2Url: stringValue(record.r2Url),
        key: stringValue(record.key),
        contentType: stringValue(record.contentType),
        size: numberValue(record.size),
        copiedAt: stringValue(record.copiedAt),
        status:
          record.status === 'ok' || record.status === 'pending' || record.status === 'failed'
            ? record.status
            : 'pending',
      } satisfies PlanningMediaMirror;
    })
    .filter((mirror): mirror is PlanningMediaMirror => !!mirror);
}

export function hydratePlanningMediaItems(
  mediaUrls: string[] | null | undefined,
  metadata: unknown,
): PlanningMediaItem[] {
  const urls = Array.isArray(mediaUrls) ? mediaUrls.filter(Boolean) : [];
  const record = asRecord(metadata);
  const rawItems = Array.isArray(record.media_items) ? record.media_items : [];
  const mirrors = getPlanningMediaMirrors(metadata);
  const mirrorByOriginal = new Map(mirrors.map((mirror) => [mirror.originalUrl, mirror]));

  const itemsByUrl = new Map<string, PlanningMediaItem>();
  for (const [index, raw] of rawItems.entries()) {
    const item = asRecord(raw);
    const url = stringValue(item.url);
    if (!url) continue;
    const fallbackUrl = stringValue(item.fallbackUrl);
    const mimeType = stringValue(item.mimeType);
    const mediaItem: PlanningMediaItem = {
      id: stringValue(item.id) || `media-meta-${index}`,
      url,
      type: inferPlanningMediaType({
        type: stringValue(item.type),
        url,
        mimeType,
      }),
      path: stringValue(item.path),
      mimeType,
      size: numberValue(item.size),
      name: stringValue(item.name),
      source:
        item.source === 'r2' ||
        item.source === 'legacy' ||
        item.source === 'generated' ||
        item.source === 'external'
          ? item.source
          : undefined,
      fallbackUrl,
    };
    itemsByUrl.set(url, mediaItem);
    if (fallbackUrl) itemsByUrl.set(fallbackUrl, mediaItem);
  }

  if (urls.length === 0 && rawItems.length > 0) {
    return Array.from(itemsByUrl.values()).filter(
      (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
    );
  }

  return urls.map((url, index) => {
    const existing = itemsByUrl.get(url);
    const mirror = mirrorByOriginal.get(url);
    if (existing) {
      return {
        ...existing,
        id: existing.id || `media-${index}`,
        url,
        fallbackUrl: existing.fallbackUrl || (mirror?.status === 'ok' ? mirror.r2Url : undefined),
      };
    }
    return {
      id: `media-${index}`,
      url,
      type: inferPlanningMediaType({
        url,
        mimeType: mirror?.contentType,
      }),
      mimeType: mirror?.contentType,
      size: mirror?.size,
      source: 'legacy',
      fallbackUrl: mirror?.status === 'ok' ? mirror.r2Url : undefined,
    };
  });
}

export function serializePlanningMediaItems(items: PlanningMediaItem[]) {
  return items.map((item, index) => ({
    id: item.id || `media-${index}`,
    url: item.url,
    type: item.type,
    ...(item.path ? { path: item.path } : {}),
    ...(item.mimeType ? { mimeType: item.mimeType } : {}),
    ...(typeof item.size === 'number' ? { size: item.size } : {}),
    ...(item.name ? { name: item.name } : {}),
    ...(item.source ? { source: item.source } : {}),
    ...(item.fallbackUrl ? { fallbackUrl: item.fallbackUrl } : {}),
  }));
}
