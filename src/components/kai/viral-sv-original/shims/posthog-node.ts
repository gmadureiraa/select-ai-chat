/**
 * Stub no-op de `posthog-node`. Server-only — só importado por arquivos
 * que rodariam no Next.js server. No KAI integrado, esses callers ficam
 * mortos (tree-shake).
 */
const noop = () => {};
class PostHog {
  capture = noop;
  identify = noop;
  shutdown = noop;
  flush = noop;
}
export { PostHog };
export default PostHog;
