import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing from workspace packages
  transpilePackages: ["@whatsapp-crm/db", "@whatsapp-crm/shared", "@whatsapp-crm/whatsapp"],
  
  // Exclude Baileys and IORedis from the browser bundle
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "ioredis",
    "bullmq",
    "@whiskeysockets/baileys",
    "xlsx",
  ],
  
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
