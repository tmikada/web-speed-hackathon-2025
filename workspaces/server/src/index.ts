import '@wsh-2025/server/src/setups/luxon';

import compress from '@fastify/compress';
import cors from '@fastify/cors';
import fastify from 'fastify';

import { registerApi } from '@wsh-2025/server/src/api';
import { initializeDatabase } from '@wsh-2025/server/src/drizzle/database';
import { registerImageHandler } from '@wsh-2025/server/src/image';
import { registerSsr } from '@wsh-2025/server/src/ssr';
import { registerStreams } from '@wsh-2025/server/src/streams';

async function main() {
  await initializeDatabase();

  const app = fastify();

  await app.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate'],
    threshold: 1024,
  });  

  app.addHook('onSend', async (_req, reply, payload) => {
    if (_req.url.match(/\/streams\/.*\.ts$/) || _req.url.startsWith('/public/')) {
      reply.header('cache-control', 'public, max-age=31536000, immutable');
    }
    else {
      reply.header('cache-control', 'no-cache');
    }
    return payload;
  });

  app.register(cors, {
    origin: true,
  });
  app.register(registerApi, { prefix: '/api' });
  app.register(registerStreams);
  registerImageHandler(app);
  app.register(registerSsr);

  await app.ready();
  const address = await app.listen({ host: '0.0.0.0', port: Number(process.env['PORT']) });
  console.log(`Server listening at ${address}`);
}

void main();
