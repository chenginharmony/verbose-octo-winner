/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
