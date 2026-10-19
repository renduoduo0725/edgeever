import { defineConfig } from "vite";
import editorConfig from "./vite.config";

// A separate entry keeps the chooser independent of the long-lived editor.
export default defineConfig({
  ...editorConfig,
  build: {
    ...editorConfig.build,
    emptyOutDir: false,
    rollupOptions: {
      input: "font-picker.html",
      output: { inlineDynamicImports: true, entryFileNames: "font-picker.js" },
    },
  },
});
