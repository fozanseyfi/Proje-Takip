import type { NextConfig } from "next";

// Sandbox modunda ayrı bir build dizini kullan ki aynı projeden iki dev server
// (ana 3000 + sandbox 3001) paralel çalışsın.
const isSandbox = process.env.NEXT_PUBLIC_SANDBOX === "1";

const nextConfig: NextConfig = {
  distDir: isSandbox ? ".next-sandbox" : ".next",
};

export default nextConfig;
