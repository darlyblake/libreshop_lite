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
  
  // Observe additions/attribute changes to detect when libraries set aria-hidden
  try {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
          const target = m.target as HTMLElement;
          try {
            // If the element (or its ancestor) receives aria-hidden="true",
            // ensure no descendant keeps focus — blur active element and set inert.
            if (target && target.getAttribute && target.getAttribute('aria-hidden') === 'true') {
              const active = document.activeElement as HTMLElement | null;
              if (active && target.contains(active)) {
                try { active.blur(); } catch (err) {}
              }
              try { (target as any).inert = true; } catch (err) {}
            }
          } catch (inner) {
            // ignore
          }
        }
        // If nodes are added dynamically, remove Google Translate scripts immediately
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0) {
          for (const n of Array.from(m.addedNodes)) {
            try {
              const el = n as HTMLElement;
              if (el && el.tagName === 'SCRIPT') {
                const src = (el as HTMLScriptElement).src || '';
                if (/translate\.google|translate\.googleapis/.test(src)) {
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

    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['aria-hidden'], childList: true });
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
