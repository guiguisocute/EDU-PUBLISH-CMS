import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const WORKER_ORIGIN = 'http://127.0.0.1:8788';

function createPreviewApiProxyPlugin() {
  return {
    name: 'preview-api-proxy',
    configurePreviewServer(server: {
      middlewares: {
        use: (handler: (req: NodeJS.ReadableStream & {
          url?: string;
          method?: string;
          headers: Record<string, string | string[] | undefined>;
        }, res: {
          statusCode: number;
          setHeader: (name: string, value: string | string[]) => void;
          end: (chunk?: Uint8Array) => void;
        }, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = String(req.url || '');

        if (!requestUrl.startsWith('/api/')) {
          next();
          return;
        }

        const bodyChunks: Uint8Array[] = [];

        for await (const chunk of req) {
          bodyChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }

        const response = await fetch(`${WORKER_ORIGIN}${requestUrl}`, {
          method: req.method || 'GET',
          headers: req.headers as HeadersInit,
          body: ['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())
            ? undefined
            : bodyChunks.length > 0
              ? Buffer.concat(bodyChunks)
              : undefined,
        });

        res.statusCode = response.status;
        const responseBody = new Uint8Array(await response.arrayBuffer());

        const setCookieValues = typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [];

        for (const [key, value] of response.headers.entries()) {
          if (['set-cookie', 'content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
            continue;
          }

          res.setHeader(key, value);
        }

        if (setCookieValues.length > 0) {
          res.setHeader('set-cookie', setCookieValues);
        }

        res.setHeader('content-length', String(responseBody.byteLength));
        res.end(responseBody);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), createPreviewApiProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './publish-ui'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: WORKER_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
