import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import { StoreProvider } from '@wsh-2025/client/src/app/StoreContext';
import { createRoutes } from '@wsh-2025/client/src/app/createRoutes';
import { createStore } from '@wsh-2025/client/src/app/createStore';
import type { FastifyInstance } from 'fastify';
import { createStandardRequest } from 'fastify-standard-request-reply';
import htmlescape from 'htmlescape';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';

function getFiles(parent: string): string[] {
  const dirents = readdirSync(parent, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isFile() && !dirent.name.startsWith('.'))
    .map((dirent) => path.join(parent, dirent.name));
}

function getFilePaths(relativePath: string, rootDir: string): string[] {
  const files = getFiles(path.resolve(rootDir, relativePath));
  return files.map((file) => path.join('/', path.relative(rootDir, file)));
}

export function registerSsr(app: FastifyInstance): void {
  app.register(fastifyStatic, {
    prefix: '/public/',
    root: [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public'),
    ],
    setHeaders: (res, path) => {
      // 画像ファイルに対してのみキャッシュヘッダーを設定
      if (path.endsWith('.webp') || path.endsWith('.jpg') || path.endsWith('.jpeg') || 
          path.endsWith('.png') || path.endsWith('.gif') || path.endsWith('.svg')) {
        // キャッシュ制御
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Vary', 'Accept, Accept-Encoding');
        res.setHeader('Accept-CH', 'DPR, Width, Viewport-Width');
        // Keep-Alive の設定
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Keep-Alive', 'timeout=3000, max=1000');
      }
    },
    cacheControl: true,
    immutable: true,
    maxAge: '1y'
  });

  app.get('/favicon.ico', (_, reply) => {
    reply.status(404).send();
  });

  app.get('/*', async (req, reply) => {
    // @ts-expect-error ................
    const request = createStandardRequest(req, reply);

    const store = createStore({});
    const handler = createStaticHandler(createRoutes(store));
    const context = await handler.query(request);

    if (context instanceof Response) {
      return reply.send(context);
    }

    const router = createStaticRouter(handler.dataRoutes, context);
    renderToString(
      <StrictMode>
        <StoreProvider createStore={() => store}>
          <StaticRouterProvider context={context} hydrate={false} router={router} />
        </StoreProvider>
      </StrictMode>,
    );

    const rootDir = path.resolve(__dirname, '../../../');
    const imagePaths = [
      getFilePaths('public/images', rootDir),
      getFilePaths('public/animations', rootDir),
      getFilePaths('public/logos', rootDir),
    ].flat();

    reply.type('text/html').send(/* html */ `
      <!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charSet="UTF-8" />
          <meta content="width=device-width, initial-scale=1.0" name="viewport" />
          <meta http-equiv="Accept-CH" content="DPR, Width, Viewport-Width" />
          <link rel="preconnect" href="/public/" />
          <script src="/public/main.js"></script>
          ${imagePaths
            .filter(path => path.match(/\.(webp|jpe?g|png|gif|svg)$/))
            .map((imagePath) => {
              // ファーストビューに表示される重要な画像のみを高優先度でプリロード
              if (imagePath.includes('thumbnail')) {
                return `<link rel="preload" as="fetch" fetchpriority="high" href="${imagePath}" />`;
              }
              // その他の画像は非同期でプリフェッチ
              return `<link rel="prefetch" href="${imagePath}" />`;
            })
            .join('\n')}
        </head>
        <body></body>
      </html>
      <script>
        window.__staticRouterHydrationData = ${htmlescape({
          actionData: context.actionData,
          loaderData: context.loaderData,
        })};
      </script>
    `);
  });
}
