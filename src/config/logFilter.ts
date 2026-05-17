// Global log filter: supprime les messages de console bruyants en web
const IGNORED_PATTERNS: RegExp[] = [
  /Running application \"main\"/, // expo dev message
  /translate\.google\.com/, // blocked translate requests
  /gen204/, // translate gen204 pings
  /net::ERR_BLOCKED_BY_CLIENT/, // adblock-type errors
  /cacheMonitor/, // our cache monitor verbose logs
  /WebSocket connection to 'ws:\/\/localhost:\d+\/(hot|message)' failed/, // HMR websocket noise
  /AuthApiError/, // supabase refresh token expiry
  /Invalid Refresh Token/,
  /message channel closed/, // extension unhandled rejections
  /translate\.googleapis\.com/, // blocked translation API
];

function shouldIgnore(args: any[]): boolean {
  try {
    return args.some((a) => {
      if (typeof a !== 'string') {
        try { a = String(a); } catch { return false; }
      }
      return IGNORED_PATTERNS.some((r) => r.test(a));
    });
  } catch (e) {
    return false;
  }
}

['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
  const orig = (console as any)[method];
  (console as any)[method] = (...args: any[]) => {
    if (shouldIgnore(args)) return; // drop
    try { orig.apply(console, args); } catch { /* ignore */ }
  };
});

export default {};
