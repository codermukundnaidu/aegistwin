import type { NextConfig } from "next";

const nextConfig: NextConfig & { agentRules?: boolean } = {
  agentRules: false,
  reactStrictMode: true,
};

export default nextConfig;
