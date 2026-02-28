import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "node18",
  outDir: "dist",
  noExternal: ["@agent-lint/shared", "@agent-lint/core"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
