import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Cloud Run
  output: 'standalone',

  // Prevent bundling issues with Genkit/Express
  serverExternalPackages: ['@genkit-ai/core', 'genkit', 'express', '@modelcontextprotocol/sdk'],

  // Configure body size limits for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },

  // Image optimization configuration for external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'goforgeit.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'app.goforgeit.com',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
