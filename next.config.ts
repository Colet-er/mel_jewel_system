import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Five 5 MB evidence images plus multipart form overhead.
      bodySizeLimit: "26mb",
    },
  },
  // The parent folder contains a stray package-lock.json, which makes
  // Turbopack infer the wrong workspace root. Pin it to this project.
  turbopack: {
    root: projectDir,
  },
};

export default nextConfig;
