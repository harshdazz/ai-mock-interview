import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Every VITE_ variable is compiled into the public bundle, and the Gemini key
  // used to be one. Nothing reads it any more, but a stray
  // `import.meta.env` would still inline it, so refuse to build while it exists.
  if (loadEnv(mode, process.cwd(), "VITE_").VITE_GEMINI_API_KEY !== undefined) {
    throw new Error(
      "VITE_GEMINI_API_KEY is set, which would publish the key in the JS bundle. Rename it to GEMINI_API_KEY in .env: only the worker and `pnpm eval` read it now."
    )
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
