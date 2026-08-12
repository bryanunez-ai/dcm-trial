import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const nextConfig: NextConfig = {
  // Turbopack infers the workspace root from the nearest lockfile and had picked C:\Users\Bry,
  // because an unrelated package-lock.json sits in the home directory. That makes the whole user
  // profile the resolution and file-watching root. Pin it to this project.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url))
  },
  experimental: {
    // Incremental, not global. With blanket PPR every route emits a static shell — and a 200 —
    // before its dynamic part runs, so a later notFound() cannot change the status code. That
    // makes a revoked /share/[token] answer 200 with the not-found page in the body, which is the
    // opposite of the guarantee that disabling a share link kills it. Routes opt in individually
    // with `export const experimental_ppr = true`.
    ppr: 'incremental',
    clientSegmentCache: true
  }
};

export default nextConfig;
