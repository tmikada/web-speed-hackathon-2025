import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.resolve(__dirname, '../../../public/images');
const CACHE_DIR = path.resolve(__dirname, '../../../public/images-resized');
const WIDTHS = [320, 480, 640];

async function generate() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const files = fs.readdirSync(IMAGE_DIR).filter((f) => f.endsWith('.webp'));
  console.log(`Generating resized images: ${files.length} files × ${WIDTHS.length} sizes...`);

  for (const file of files) {
    const srcPath = path.join(IMAGE_DIR, file);
    const name = path.parse(file).name;

    await Promise.all(
      WIDTHS.map(async (width) => {
        const outPath = path.join(CACHE_DIR, `${name}_w${width}.webp`);
        if (fs.existsSync(outPath)) return;
        await sharp(srcPath)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(outPath);
      }),
    );
  }

  console.log(`Done. Generated ${files.length * WIDTHS.length} images in ${CACHE_DIR}`);
}

generate();
