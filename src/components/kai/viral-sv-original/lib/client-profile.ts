interface SocialMap {
  [key: string]: unknown;
}

interface ClientLike {
  name?: string | null;
  avatar_url?: string | null;
  social_media?: SocialMap | null;
  tags?: SocialMap | null;
}

interface UserProfileLike {
  name?: string | null;
  twitter_handle?: string | null;
  instagram_handle?: string | null;
  avatar_url?: string | null;
}

export interface SVPreviewProfile {
  name: string;
  handle: string;
  photoUrl: string;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function cleanHandle(value: string | null): string | null {
  if (!value) return null;
  const withoutUrl = value
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/^(instagram|twitter|x)\.com\//i, "")
    .split(/[/?#]/)[0]
    .trim();
  const clean = withoutUrl.replace(/^@/, "").trim();
  return clean || null;
}

function handleFromSocial(social?: SocialMap | null): string | null {
  if (!social) return null;
  return (
    cleanHandle(
      firstString(
        social.twitter,
        social.x,
        social.twitter_handle,
        social.x_handle,
      ),
    ) ||
    cleanHandle(
      firstString(
        social.instagram,
        social.instagram_handle,
        social.ig,
        social.ig_handle,
      ),
    )
  );
}

export function buildSVPreviewProfile(
  client: ClientLike | null | undefined,
  fallbackProfile: UserProfileLike | null | undefined,
): SVPreviewProfile {
  // 2026-05-20 fix (handle "@seuhandle" no Defiverso): o Data API pode devolver
  // jsonb (social_media/tags) como STRING no browser. Se vier string, faz
  // JSON.parse antes de acessar as chaves — senão social.instagram é undefined
  // e o handle cai no fallback "@seuhandle".
  const asObject = (v: unknown): SocialMap | null => {
    if (!v) return null;
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return parsed && typeof parsed === "object" ? (parsed as SocialMap) : null;
      } catch {
        return null;
      }
    }
    return typeof v === "object" ? (v as SocialMap) : null;
  };
  const socialMap = asObject(client?.social_media);
  const tagsMap = asObject(client?.tags);

  const clientHandle =
    handleFromSocial(socialMap) || handleFromSocial(tagsMap);
  const fallbackHandle =
    cleanHandle(fallbackProfile?.twitter_handle ?? null) ||
    cleanHandle(fallbackProfile?.instagram_handle ?? null);
  const handle = clientHandle || fallbackHandle;
  const tagsAsMap = tagsMap as { [key: string]: unknown } | null | undefined;
  // TODO(2026-05-19): se Gabriel limpar `client.avatar_url` explicitamente
  // (set null/empty), o fallback ainda pega logo antigo de
  // tags.logo_url/avatar_url/profile_image_url e a foto "volta" no template.
  // Considerar respeitar null intencional vs. "nunca foi setado" — talvez
  // distinguir avatar_url=null (clear explícito) de avatar_url=undefined.
  // Não alterar agora pra não quebrar clientes legados que só têm logo em tags.
  const logoFromTags = firstString(
    tagsAsMap?.logo_url,
    tagsAsMap?.avatar_url,
    tagsAsMap?.profile_image_url,
  );

  return {
    name: firstString(client?.name, fallbackProfile?.name) || "Seu nome",
    handle: handle ? `@${handle}` : "@seuhandle",
    // 2026-05-20 fix (Gabriel): NÃO cair no avatar do usuário (Gabriel) quando o
    // cliente não tem foto — isso colocava a cara do Gabriel em carrosséis de
    // Alfred/Lucas/Hugo (avatar null). Sem foto do cliente → vazio → o template
    // mostra a inicial do cliente (neutro/correto). Só client.avatar_url → logo.
    photoUrl: firstString(client?.avatar_url, logoFromTags) || "",
  };
}
