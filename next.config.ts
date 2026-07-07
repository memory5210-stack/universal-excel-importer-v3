import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    allowedHosts: [".monkeycode-ai.online"],
  },
};

export default nextConfig;
