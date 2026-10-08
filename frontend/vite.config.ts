import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

const apiTarget = process.env.API_URL ?? 'http://localhost:5080'

/**
 * Writes .br and .gz copies of the built scripts and styles at maximum compression. ASP.NET Core serves them
 * as-is (PrecompressedAssetsMiddleware), which is smaller than compressing on the fly and costs no CPU per request.
 */
function precompress(): Plugin {
  const brotli = promisify(brotliCompress)
  const gz = promisify(gzip)
  return {
    name: 'grabity-precompress',
    apply: 'build',
    async writeBundle(options, bundle) {
      const files = Object.keys(bundle).filter((name) => /^assets\/.*\.(js|css|svg|json)$/.test(name))
      await Promise.all(
        files.map(async (name) => {
          const path = join(options.dir!, name)
          const source = await readFile(path)
          if (source.length < 1024) return
          const [br, gzipped] = await Promise.all([
            brotli(source, { params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY, [constants.BROTLI_PARAM_SIZE_HINT]: source.length } }),
            gz(source, { level: constants.Z_BEST_COMPRESSION }),
          ])
          await Promise.all([writeFile(`${path}.br`, br), writeFile(`${path}.gz`, gzipped)])
        }),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), precompress()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // The API and uploaded images are served by ASP.NET Core; proxying keeps everything same-origin
    // so the auth cookie works exactly like in production.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
      '/uploads': { target: apiTarget, changeOrigin: false },
      '/sitemap.xml': { target: apiTarget, changeOrigin: false },
      '/robots.txt': { target: apiTarget, changeOrigin: false },
    },
  },
  build: {
    // ASP.NET Core serves the built storefront from its wwwroot folder.
    outDir: '../backend/Grabity.Api/wwwroot',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    // Maps source files to built chunks; SpaRenderer.cs uses it to preload a page's chunk. Not the default
    // .vite/manifest.json, because dotnet publish leaves out dot-folders.
    manifest: 'vite-manifest.json',
    // Inlined fonts would grow the render-blocking stylesheet; as files they load only when a page needs them.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
})
