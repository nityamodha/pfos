import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force every client-side navigation to refetch dynamic routes. This is a personal
  // finance app — a stale balance/account list served from the client router cache is
  // worse than an extra request. Explicit rather than relying on the framework default.
  experimental: {
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
