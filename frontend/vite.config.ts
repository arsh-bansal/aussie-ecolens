import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `amazon-cognito-identity-js` references the Node.js `global` symbol, which
// is undefined in browsers. Aliasing it to `globalThis` avoids the runtime
// ReferenceError without pulling in a full Node polyfill.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
});
