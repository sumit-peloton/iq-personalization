import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so built asset URLs resolve under a GitHub Pages project
  // subpath (https://<user>.github.io/<repo>/) as well as at a domain root.
  base: "./",
  plugins: [react()],
});
