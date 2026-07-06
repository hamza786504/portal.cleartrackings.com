/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads (up to 300MB) for the cases API
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-mariadb', 'mariadb', 'googleapis'],

  experimental: {
    // Increase body size limit for file uploads via the cases route
    serverActions: {
      bodySizeLimit: '300mb',
    },
  },
};

export default nextConfig;
