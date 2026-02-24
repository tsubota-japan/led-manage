import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentationHook is enabled by default in Next.js 14+
  experimental: {
    // ミドルウェア/プロキシのリクエストボディ上限（デフォルト 10MB）を拡張
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
