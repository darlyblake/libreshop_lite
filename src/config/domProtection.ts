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

  // Shield Node.prototype from Google Translate / extension DOM mutations
  try {
    const originalRemoveChild = Node.prototype.removeChild;
    const originalInsertBefore = Node.prototype.insertBefore;
    const originalAppendChild = Node.prototype.appendChild;

    (Node.prototype as any).removeChild = function(this: Node, child: any) {
      if (child && child.parentNode !== this) {
        console.warn("[DOM Shield] Intercepted removeChild for non-child node:", this, child);
        return child;
      }
      return originalRemoveChild.call(this, child);
    };

    (Node.prototype as any).insertBefore = function(this: Node, newNode: any, referenceNode: any) {
      if (referenceNode && referenceNode.parentNode !== this) {
        console.warn("[DOM Shield] Intercepted insertBefore for non-child reference node:", this, referenceNode);
        return originalAppendChild.call(this, newNode);
      }
      return originalInsertBefore.call(this, newNode, referenceNode);
    };
  } catch (e) {
    console.debug('Failed to patch Node.prototype:', e);
  }

  // Disable Google Translate API
  (window as any).google = (window as any).google || {};
  (window as any).google.translate = { TranslateElement: null };

  // Block translate events (safe optional chaining)
  const preventTranslate = (e: any) => {
    e.preventDefault?.();
    return false;
  };

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforetranslate', preventTranslate);
  }

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
    // Remove any existing Google Translate script tags
    const removeTranslateScripts = () => {
      try {
        const scripts = Array.from(document.querySelectorAll('script')) as HTMLScriptElement[];
        for (const s of scripts) {
          const src = s.src || '';
          if (/translate\.google|translate\.googleapis/.test(src)) {
            try { s.remove(); } catch (err) {}
          }
        }
      } catch (e) {
        // ignore
      }
    };
    removeTranslateScripts();
  } catch (e) {
    // Silently fail if DOM operations aren't available
    console.debug('DOM protection setup failed (expected in React Native):', e);
  }
  
  // Observe only childList for translator scripts — avoid touching aria-hidden
  // because React Native Web manages it internally for screen/modal visibility.
  // Interfering with aria-hidden can freeze the page when React updates modals.
  try {
    const observer = new MutationObserver((mutations) => {
      // Only remove injected translator scripts, don't process aria-hidden changes
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0) {
          for (const n of Array.from(m.addedNodes)) {
            try {
              const el = n as HTMLElement;
              if (el && el.tagName === 'SCRIPT') {
                const src = (el as HTMLScriptElement).src || '';
                if (/translate\.google|translate\.googleapis|google\.com\/translate/.test(src)) {
                  try { el.remove(); } catch (err) {}
                }
              }
            } catch (err) {
              // ignore
            }
          }
        }
      }
    });

    // Only observe childList changes, NOT attribute changes for aria-hidden
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    // ignore observer failures
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
