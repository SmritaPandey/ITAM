import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" is for Docker deployments only
  // Vercel uses its own optimized build pipeline
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
