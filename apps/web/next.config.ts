import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@moajoa/core', '@moajoa/api', '@moajoa/ui-tokens'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default config;
