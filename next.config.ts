import type { NextConfig } from "next";

const shouldExport = process.env.STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  /* config options here */
  ...(shouldExport ? { output: 'export' } : {}),
};

export default nextConfig;
