import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentationHook is enabled by default in Next.js 14+
  experimental: {
    // App Router Route Handler のリクエストボディ上限（デフォルト 10MB）を拡張
    proxyClientMaxBodySize: "110mb",
  },
};

export default nextConfig;
