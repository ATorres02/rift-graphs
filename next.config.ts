import type { NextConfig } from "next";

/**
 * The site is a static export served by Cloudflare Workers (Static Assets):
 * no server at runtime, so images are not optimised on the fly (champion icons
 * come from Data Dragon's CDN at a fixed size).
 */
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "ddragon.leagueoflegends.com", pathname: "/cdn/**" }],
  },
};

export default nextConfig;
