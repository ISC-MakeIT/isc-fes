import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ["./src/app/**"],
  },
  {
    // Next.js の app/pages と衝突するため、FSDの公式ガイドに従ってpages 層を
    // _pages にリネームしている。リンター側は接頭辞を考慮せず typo 判定するので off にする。
    // https://feature-sliced.design/docs/guides/tech/with-nextjs
    files: ["./src/_pages/**"],
    rules: {
      "fsd/typo-in-layer-name": "off",
    },
  },
  {
    files: ["./src/entities/**"],
    rules: {
      "fsd/insignificant-slice": "warn",
    },
  },
]);
