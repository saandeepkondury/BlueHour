import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "web-push"],
  // Phone hits the Mac over LAN during local Health sync.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.174"],
};

export default nextConfig;
