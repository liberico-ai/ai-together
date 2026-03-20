import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker production deployment
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" }, // Allow MinIO URLs locally
    ],
  },
};

export default nextConfig;
