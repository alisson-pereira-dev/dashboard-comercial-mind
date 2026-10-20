import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O Dockerfile liga o modo standalone (servidor enxuto para a imagem). Fora do Docker, o
  // build e o `npm start` seguem como sempre.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
