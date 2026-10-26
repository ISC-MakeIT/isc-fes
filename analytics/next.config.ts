import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  serverExternalPackages: ["pg"],
  turbopack: { root: path.resolve(import.meta.dirname) },
};
export default config;
