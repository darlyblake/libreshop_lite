// Global log filter: supprime les messages de console bruyants en web
const IGNORED_PATTERNS: RegExp[] = [
  /Running application \"main\"/, // expo dev message
  /translate\.google\.com/, // blocked translate requests
  /gen204/, // translate gen204 pings
  /net::ERR_BLOCKED_BY_CLIENT/, // adblock-type errors
  /^\[SkiaLoader\]/, // non-critical Skia loader messages
  /WebSocket connection to 'ws:\/\/localhost:\d+\/(hot|message)' failed/, // HMR websocket noise
  /AuthApiError/, // supabase refresh token expiry
  /Invalid Refresh Token/,
  /message channel closed/, // extension unhandled rejections
  /translate\.googleapis\.com/, // blocked translation API
  /A listener indicated an asynchronous response/, // common extension warning
  /\[DEPRECATED\] Default export is deprecated/, // zustand deprecation log injected via instrument script
  /Failed to initialize Skia Web: Infinity/, // sometimes cached
  /SyntaxError: Unexpected end of input/, // external inject script failure (e.g. Vercel feedback widget)
  /Blocked aria-hidden on an element/, // react-dom aria-hidden warning
  /useNativeDriver is not supported/, // react-native-web Animated warning
  /increment_product_views/, // supabase rpc 404 fetch error logs
  /Failed to execute 'removeChild'/, // google translate extension crash
  /\[DOM Shield\]/, // our defensive dom protective logs
  /NotFoundError: Failed to execute/, // dom exception string
  /TouchableWithoutFeedback is deprecated/, // react-native-web deprecation warning
  /\[OptimizedImage\] Image load error: undefined/, // missing fallback URL errors
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
