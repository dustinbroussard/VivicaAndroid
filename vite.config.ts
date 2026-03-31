
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "fs";
import type { ServerResponse } from "http";
import type { Plugin } from "vite";

const manifest = JSON.parse(
  readFileSync(path.resolve(__dirname, "public/manifest.json"), "utf-8")
);

function writeProxyError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

function rssDevProxyPlugin(): Plugin {
  return {
    name: "rss-dev-proxy",
    configureServer(server) {
      server.middlewares.use("/api/rss-proxy", async (req, res) => {
        try {
          const parsed = new URL(req.url || "", "http://localhost");
          const targetUrl = parsed.searchParams.get("url");

          if (!targetUrl) {
            writeProxyError(res, 400, "Missing url query parameter");
            return;
          }

          const safeUrl = new URL(targetUrl);
          if (!["http:", "https:"].includes(safeUrl.protocol)) {
            writeProxyError(res, 400, "Only http/https URLs are supported");
            return;
          }

          const upstream = await fetch(safeUrl.toString(), { redirect: "follow" });
          if (!upstream.ok) {
            writeProxyError(res, upstream.status, `Upstream request failed (${upstream.status})`);
            return;
          }

          const body = await upstream.text();
          res.statusCode = 200;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/plain; charset=utf-8");
          res.end(body);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown proxy error";
          writeProxyError(res, 502, message);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
// Use a relative production base so the app can be served from any GitHub Pages repo path.
const defaultBase = './';

export default defineConfig(({ mode }) => ({
  // Allow explicit overrides, but keep the default build path-agnostic for GitHub Pages.
  base: process.env.VITE_BASE || (mode === 'production' ? defaultBase : '/'),
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)'
    }
  },
  server: {
    host: "::",
    port: 8080,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)'
    }
  },
  plugins: [
    react(),
    rssDevProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt', 'icons/*', 'uploads/*'],
      manifest,
      workbox: {
        navigateFallback: 'offline.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Built static assets
            urlPattern: /\/assets\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // JSON and API GET requests over HTTP(S)
            urlPattern: /^https?:.*\/(?:api|json|data)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      }
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
