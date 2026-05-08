/**
 * Stub no-op de `posthog-js`.
 *
 * Tracking analytics fica fora do scope desse copy literal — KAI tem seu
 * próprio sistema. Mantemos a shape mínima pra que `posthog.capture()` e
 * `posthog.identify()` continuem sem dar runtime error.
 */
const noop = () => {};

const posthog = {
  capture: noop,
  identify: noop,
  reset: noop,
  startSessionRecording: noop,
  stopSessionRecording: noop,
  register: noop,
  unregister: noop,
  setPersonProperties: noop,
  alias: noop,
  init: noop,
  group: noop,
  isFeatureEnabled: () => false,
  getFeatureFlag: () => undefined,
  onFeatureFlags: noop,
  // Feature flag bootstrap — return undefined for everything
  decideEndpointWasHit: false,
  has_opted_out_capturing: () => false,
  opt_in_capturing: noop,
  opt_out_capturing: noop,
};

export default posthog;
