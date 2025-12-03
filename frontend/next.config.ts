import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "dist",
  output: "export",
  images: {
    unoptimized: true,
  },
  // Không cần assetPrefix vì đã dùng local HTTP server
  // assetPrefix: "./",
};

export default nextConfig;
