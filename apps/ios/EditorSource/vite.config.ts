import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
  base: "./",
  // The shared workspace package is linked from outside EditorSource. Preserve
  // that symlink so Vite resolves its TipTap imports from this package's clean
  // install as well as from a fully installed monorepo checkout.
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: "../EditorBundle",
    emptyOutDir: true,
    // Keep large, on-demand card fonts out of the editor's initial HTML parse.
    assetsInlineLimit: (path) => !/[\/](?:note-image-assets|font-assets)[\/]/.test(path),
    cssCodeSplit: false,
    rollupOptions: {
      input: "index.html",
      // The script is inlined into root index.html, so asset URLs must also
      // be calculated relative to the root rather than assets/editor.js.
      output: { inlineDynamicImports: true, entryFileNames: "editor.js" },
    },
  },
});
