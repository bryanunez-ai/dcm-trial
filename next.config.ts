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
    ppr: true,
    clientSegmentCache: true
  }
};

export default nextConfig;
