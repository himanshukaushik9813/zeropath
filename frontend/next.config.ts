import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config) => {
    // Enable async WebAssembly for snarkjs circuit loading
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // snarkjs references Node.js modules that don't exist in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      readline: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      constants: false,
    };
    return config;
  },
};

export default nextConfig;
