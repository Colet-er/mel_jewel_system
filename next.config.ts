import type { NextConfig } from "next";

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
    root: __dirname,
  },
};

export default nextConfig;
