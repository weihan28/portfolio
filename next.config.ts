import type { NextConfig } from "next";

// The game and model binaries under /lab are large and never change in place: a new version gets a new name
// (doom.v1.wasm → doom.v2.wasm), so browsers can keep them for a year without asking again. doom1.wad is the
// unmodified shareware file and never changes. Everything else in public/ keeps Next's default (revalidate on use).
const YEAR = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/lab/:dir/:file(.*\\.v\\d+\\.[a-z]+)", headers: YEAR },
      { source: "/lab/doom/doom1.wad", headers: YEAR },
    ];
  },
};

export default nextConfig;
