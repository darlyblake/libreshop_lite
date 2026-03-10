/**
 * DOM Protection Configuration
 * Prevents external scripts (Google Translate, etc.) from interfering with React
 * Only runs in browser environment, safe for React Native
 */

export const initializeDOMProtection = () => {
  // Only run in web environment - check for document (not just window)
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  // Disable Google Translate API
  (window as any).google = (window as any).google || {};
  (window as any).google.translate = { TranslateElement: null };

  // Block translate events
  const preventTranslate = (e: Event) => {
    e.preventDefault();
    return false;
  };

  window.addEventListener('beforetranslate', preventTranslate);

  // Protect root element from mutations
  try {
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('translate', 'no');
      root.setAttribute('data-notranslate', 'true');
      (root as any).__protected = true;
    }

    // Hide Google Translate elements if they appear
    const style = document.createElement('style');
    style.innerHTML = `
      .goog-te-banner-frame,
      .goog-te-gadget,
      .goog-te-gadget-simple,
      .goog-top-panel,
      .skiptranslate,
      .goog-te-tooltip,
      .goog-te-button {
        display: none !important;
        visibility: hidden !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
      }
    `;
    document.head.appendChild(style);
  } catch (e) {
    // Silently fail if DOM operations aren't available
    console.debug('DOM protection setup failed (expected in React Native):', e);
  }
};

// Initialize on module load if in browser environment only
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeDOMProtection);
    } else {
      initializeDOMProtection();
    }
  } catch (e) {
    // Silently fail - this is expected in React Native environments
    console.debug('DOM protection initialization skipped (React Native environment)');
  }
}
