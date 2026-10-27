/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy native packages on the server side — never bundled into the client
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-mariadb', 'mariadb', 'googleapis', 'nodemailer'],

  experimental: {
    // 50 MB is a realistic upper bound for dental scan files + patient images.
    // The previous 300 MB limit meant a single bad request could consume 300 MB
    // of server RAM, spiking processes and causing 503 errors.
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
