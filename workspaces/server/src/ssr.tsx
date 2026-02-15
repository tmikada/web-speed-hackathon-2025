import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
        <StoreProvider createStore={() => hydratedStore}>
          <StaticRouterProvider context={context} hydrate={true} router={router} />
        </StoreProvider>
      </StrictMode>,
      {
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
              <head><script defer src="/public/main.js"></script></head>
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
