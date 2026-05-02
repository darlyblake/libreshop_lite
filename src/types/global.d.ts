// Type stubs for third-party packages missing type declarations in the repo
// Added to satisfy Vercel/TypeScript build where @types packages are not installed

declare module '@vercel/node' {
  import type { VercelRequest, VercelResponse } from '@vercel/node';
  // Minimal exports to allow imports like `import { send } from '@vercel/node'`
  export type { VercelRequest, VercelResponse };
}

declare module 'node-fetch';
declare module 'node-fetch/lib/index.js';

// Generic fallback for any other missing modules (optional)
declare module '*';
