import { readdirSync, readFileSync } from 'node:fs';
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

interface WebpackManifest {
  [key: string]: string;
}

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
  const clientDistPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  const publicPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public');
  
  // マニフェストファイルを読み込む
  const manifestPath = path.join(clientDistPath, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as WebpackManifest;

  app.register(fastifyStatic, {
    prefix: '/public/',
    root: [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), clientDistPath),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), publicPath),
    ],
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

    // JavaScriptファイルの読み込み順序を制御
    const criticalJsFiles = [
      manifest['runtime.js'] || '',  // ランタイムを最初に
      manifest['main.js'] || '',     // メインバンドル
    ].filter(Boolean);

    const deferredJsFiles = Object.entries(manifest)
      .filter(([key]) => key.startsWith('vendor.') || key.startsWith('common.'))
      .map(([, value]) => value)
      .filter(Boolean);
      
    reply.type('text/html').send(/* html */ `
      <!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charSet="UTF-8" />
          <meta content="width=device-width, initial-scale=1.0" name="viewport" />
          ${imagePaths.map((imagePath) => `<link as="image" href="${imagePath}" rel="preload" />`).join('\n')}
          </head>
          <body>
          ${criticalJsFiles.map(file => `<script src="${file}" defer></script>`).join('\n')}
          ${deferredJsFiles.map(file => `<script src="${file}" defer></script>`).join('\n')}
          </body>
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
