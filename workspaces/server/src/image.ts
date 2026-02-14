import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.resolve(__dirname, '../../../public/images');
const IMAGE_RESIZED_DIR = path.resolve(__dirname, '../../../public/images-resized');

export function registerImageHandler(app: FastifyInstance): void {
  app.get<{ Params: { filename: string }; Querystring: { w?: string } }>(
    '/public/images/:filename',
    async (req, reply) => {
      const { filename } = req.params;
      const width = parseInt(req.query.w ?? '', 10);

      // w パラメータがない場合は元画像をそのまま返す
      if (!width || isNaN(width)) {
        const srcPath = path.join(IMAGE_DIR, filename);
        if (!fs.existsSync(srcPath)) {
          return reply.status(404).send();
        }
        reply.type('image/webp');
        reply.header('cache-control', 'public, max-age=86400');
        return reply.send(fs.createReadStream(srcPath));
      }

      // リサイズ済みファイルを参照（事前生成済み）
      const resizedName = `${path.parse(filename).name}_w${width}.webp`;
      const resizedPath = path.join(IMAGE_RESIZED_DIR, resizedName);

      if (fs.existsSync(resizedPath)) {
        reply.type('image/webp');
        reply.header('cache-control', 'public, max-age=86400');
        return reply.send(fs.createReadStream(resizedPath));
      }

      // リサイズ済みファイルがない場合は元画像を返す
      const srcPath = path.join(IMAGE_DIR, filename);
      if (!fs.existsSync(srcPath)) {
        return reply.status(404).send();
      }
      reply.type('image/webp');
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(fs.createReadStream(srcPath));
    },
  );
}
