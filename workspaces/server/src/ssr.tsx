import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { merge } from 'es-toolkit/compat';
import fastifyStatic from '@fastify/static';
import { StoreProvider } from '@wsh-2025/client/src/app/StoreContext';
import { createRoutes } from '@wsh-2025/client/src/app/createRoutes';
import { createStore } from '@wsh-2025/client/src/app/createStore';
import type { FastifyInstance } from 'fastify';
import { createStandardRequest } from 'fastify-standard-request-reply';
import { StrictMode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { CssContext } from '@wsh-2025/client/src/app/CssContext';

const cssFilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist/main.css');
let cssContent = '';
try {
  cssContent = readFileSync(cssFilePath, 'utf-8');
} catch {
  // CSS未ビルドの場合（開発環境等）はフォールバック
}

export function registerSsr(app: FastifyInstance): void {
  app.register(fastifyStatic, {
    prefix: '/public/',
    root: [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist'),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public'),
    ],
  });

  app.get('/favicon.ico', (_, reply) => {
    return reply.status(404).send();
  });

  app.get('/*', async (req, reply) => {
    // @ts-expect-error ................
    const request = createStandardRequest(req, reply);

    const store = createStore({});

    // ★ 追加: URLに応じてapp.inject()でデータ取得し、ストアに注入
    const pathname = req.url?.split('?')[0] ?? '';

    const episodeMatch = pathname.match(/^\/episodes\/([^\/]+)$/);
    const programMatch = pathname.match(/^\/programs\/([^\/]+)$/);
    const seriesMatch = pathname.match(/^\/series\/([^\/]+)$/);

    if (episodeMatch) {
      const episodeId = episodeMatch[1]!;
      const res = await app.inject({ method: 'GET', url: `/api/episodes/${episodeId}` });
      if (res.statusCode === 200) {
        const episode = JSON.parse(res.body);
        store.setState((s) => merge(s, {
          features: { episode: { episodes: { [episodeId]: episode } } }
        }));
      }
    } else if (programMatch) {
      const programId = programMatch[1]!;
      const res = await app.inject({ method: 'GET', url: `/api/programs/${programId}` });
      if (res.statusCode === 200) {
        const program = JSON.parse(res.body);
        store.setState((s) => merge(s, {
          features: { program: { programs: { [programId]: program } } }
        }));
      }
    } else if (seriesMatch) {
      const seriesId = seriesMatch[1]!;
      const res = await app.inject({ method: 'GET', url: `/api/series/${seriesId}` });
      if (res.statusCode === 200) {
        const series = JSON.parse(res.body);
        store.setState((s) => merge(s, {
          features: { series: { series: { [seriesId]: series } } }
        }));
      }
    }
    if (pathname === '/') {
      const res = await app.inject({ method: 'GET', url: '/api/recommended/entrance' });
      if (res.statusCode === 200) {
        const modules = JSON.parse(res.body);
        store.setState((s) => merge(s, {
          features: {
            recommended: {
              references: { entrance: modules.map((m: { id: string }) => m.id) },
              recommendedModules: Object.fromEntries(modules.map((m: { id: string }) => [m.id, m])),
            },
          },
        }));
      }
    }
    
    const routes = createRoutes(store);
    const handler = createStaticHandler(routes);
    const context = await handler.query(request);

    if (context instanceof Response) {
      return reply.send(context);
    }

    // SSR: zustandのuseSyncExternalStoreはSSRでgetInitialState(初期状態)を返すため、
    // prefetchでstoreが更新されても反映されない。
    // 対策: prefetch後の状態をhydrationDataとして新しいstoreを作成し直す。
    const hydratedStore = createStore({ hydrationData: store.getState() });

    const router = createStaticRouter(handler.dataRoutes, context);
    const { pipe } = renderToPipeableStream(
      <StrictMode>
        <CssContext.Provider value={cssContent}>
          <StoreProvider createStore={() => hydratedStore}>
            <StaticRouterProvider context={context} hydrate={true} router={router} />
          </StoreProvider>
        </CssContext.Provider>
      </StrictMode>,
      {
        bootstrapScriptContent: `window.__zustandHydrationData=${JSON.stringify(hydratedStore.getState())};`,
        onShellReady() {
          const passthrough = new PassThrough();
          reply.type('text/html').send(passthrough);
          passthrough.write('<!DOCTYPE html>');
          pipe(passthrough);
        },
        onShellError() {
          // フォールバック: 空HTMLを返してCSRにフォールバック
          reply.status(500).type('text/html').send(`
            <!DOCTYPE html>
            <html lang="ja">
              <head>
                <link rel="stylesheet" href="/public/main.css">
                <script defer src="/public/main.js"></script>
              </head>
              <body></body>
            </html>
          `);
        },
        onError(error) {
          console.error('SSR streaming error:', error);
        },
      }
    );

    return reply;
  });
}
