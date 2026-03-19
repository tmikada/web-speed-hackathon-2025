# レスポンシブ画像の最適化

## 課題

Lighthouse の「画像配信を改善する」で **推定削減サイズ 8,472 KiB** が報告されている。

主な原因:

| 問題 | 詳細 |
|------|------|
| **過大な画像サイズ** | 元画像は全て 1200x675px だが、表示は最大でも 427x240px 程度 |
| **フォーマット** | JPEG のみ。WebP/AVIF 未対応（※ 別途対応予定） |

## 現状分析

### 画像ファイル

- 場所: `public/images/`
- ファイル数: 37枚（JPEG）
- サイズ: 合計 4.5MB、平均 ~122KB/枚
- 解像度: **全て 1200x675px**

### 画像の参照元（DB → thumbnailUrl）

`workspaces/server/tools/seed.ts` で `/public/images/XXX.jpeg` のパスが DB に格納され、API 経由でクライアントに渡される。

### 画像の表示箇所と表示サイズ

| コンポーネント | ファイル | 表示幅 | 配信 vs 表示 |
|----------------|----------|--------|-------------|
| EpisodeItem（カルーセル） | `client/src/features/recommended/components/EpisodeItem.tsx` | ~200-300px | 1200px → ~300px（4x過剰） |
| SeriesItem（カルーセル） | `client/src/features/recommended/components/SeriesItem.tsx` | ~200-300px | 1200px → ~300px（4x過剰） |
| SeriesEpisodeItem（一覧） | `client/src/features/series/components/SeriesEposideItem.tsx` | **192px固定** | 1200px → 192px（6x過剰） |
| Program（番組表） | `client/src/pages/timetable/components/Program.tsx` | ~150-200px | 1200px → ~150px（8x過剰） |
| ProgramDetailDialog | `client/src/pages/timetable/components/ProgramDetailDialog.tsx` | ~400-600px | 1200px → ~600px（2x過剰） |
| EpisodePage（メイン） | `client/src/pages/episode/components/EpisodePage.tsx` | max 1280px | 1200px ≈ 適正 |

## 対応方針

### アプローチ: ビルド時プリウォーム + オンデマンドフォールバック

**ビルド時に全画像の全サイズバリアントを事前生成**し、リクエスト時はキャッシュ済みファイルを即座に配信する。未キャッシュの場合のみオンデマンドでリサイズする。

理由:
- 画像パスは DB に格納されており、seed 変更の影響範囲を最小化したい
- フォーマット変換（WebP/AVIF）も同じ仕組みで後から追加しやすい
- **初回リクエスト時のリサイズ処理を回避**し、特に番組表ページ（大量画像同時リクエスト）でのレイテンシを防ぐ
- 37枚 × 4サイズ = 148枚の事前生成は数秒で完了するため、ビルド時間への影響は軽微

### URL設計

```
/public/images/011.jpeg?w=480        → 幅480pxにリサイズ
/public/images/011.jpeg?w=480&f=webp → 幅480px + WebP変換（将来対応）
```

### 実装ステップ

#### Step 1: sharp の導入

```bash
pnpm --filter @wsh-2025/server add sharp
```

#### Step 2: ビルド時プリウォームスクリプト

`workspaces/server/tools/generate-resized-images.ts` を新規作成。`pnpm run build` の一部として実行する。

```typescript
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

const IMAGE_DIR = path.resolve(__dirname, '../../../../public/images');
const CACHE_DIR = path.resolve(__dirname, '../../../../public/images-resized');
const WIDTHS = [320, 384, 480, 640];

async function generate() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const files = fs.readdirSync(IMAGE_DIR).filter((f) => f.endsWith('.jpeg'));
  console.log(`Generating resized images: ${files.length} files × ${WIDTHS.length} sizes...`);

  for (const file of files) {
    const srcPath = path.join(IMAGE_DIR, file);
    const name = path.parse(file).name;

    await Promise.all(
      WIDTHS.map(async (width) => {
        const outPath = path.join(CACHE_DIR, `${name}_w${width}.jpeg`);
        if (fs.existsSync(outPath)) return; // スキップ（冪等）
        await sharp(srcPath)
          .resize(width, null, { withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(outPath);
      }),
    );
  }

  console.log(`Done. Generated ${files.length * WIDTHS.length} images in ${CACHE_DIR}`);
}

generate();
```

**特徴**:
- 冪等性あり（既存ファイルはスキップ）
- 37枚 × 4サイズ = 148枚、数秒で完了
- `POST /api/initialize` でリセットが必要な場合は CACHE_DIR ごと再生成

#### Step 3: 画像リサイズミドルウェア（キャッシュ配信 + フォールバック）

`workspaces/server/src/image.ts` を新規作成:

```typescript
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';

const IMAGE_DIR = path.resolve(/* public/images のパス */);
const CACHE_DIR = path.resolve(/* public/images-resized のパス */);

export function registerImageHandler(app: FastifyInstance) {
  app.get('/public/images/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const width = parseInt((req.query as { w?: string }).w ?? '', 10);

    const srcPath = path.join(IMAGE_DIR, filename);
    if (!fs.existsSync(srcPath)) {
      return reply.status(404).send();
    }

    // w パラメータがない場合は元画像を返す
    if (!width || isNaN(width)) {
      return reply.sendFile(filename);
    }

    // キャッシュ確認（ビルド時生成済みのはず）
    const cacheKey = `${path.parse(filename).name}_w${width}.jpeg`;
    const cachePath = path.join(CACHE_DIR, cacheKey);

    if (fs.existsSync(cachePath)) {
      reply.type('image/jpeg');
      reply.header('cache-control', 'public, max-age=86400');
      return reply.send(fs.createReadStream(cachePath));
    }

    // フォールバック: 未キャッシュの場合のみオンデマンドリサイズ
    const resized = await sharp(srcPath)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, resized);

    reply.type('image/jpeg');
    reply.header('cache-control', 'public, max-age=86400');
    return reply.send(resized);
  });
}
```

**注意**: `fastifyStatic` より**前に**このルートを登録する必要がある（static が先だとクエリパラメータ無視で元画像を返す）。

#### Step 4: クライアント側で適切な幅を指定

各コンポーネントで `thumbnailUrl` に `?w=XXX` を付与する。

```typescript
// ユーティリティ関数
function resizedImageUrl(url: string, width: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=${width}`;
}
```

| コンポーネント | 推奨幅 | 理由 |
|----------------|--------|------|
| EpisodeItem | `w=480` | カルーセル内、Retina 2x 考慮で 240×2 |
| SeriesItem | `w=480` | 同上 |
| SeriesEpisodeItem | `w=384` | 固定幅 192px × 2x |
| Program（番組表） | `w=320` | 小さい表示、2x でも十分 |
| ProgramDetailDialog | `w=640` | ダイアログ内、中サイズ |
| EpisodePage（メイン） | そのまま | 最大 1280px 表示のため元画像でOK |

#### Step 5: srcset 対応（任意・追加最適化）

ブラウザに最適サイズを選ばせる場合:

```tsx
<img
  alt=""
  className="aspect-video h-auto w-full"
  src={resizedImageUrl(episode.thumbnailUrl, 480)}
  srcSet={`
    ${resizedImageUrl(episode.thumbnailUrl, 320)} 320w,
    ${resizedImageUrl(episode.thumbnailUrl, 480)} 480w,
    ${resizedImageUrl(episode.thumbnailUrl, 640)} 640w
  `}
  sizes="(max-width: 600px) 100vw, 300px"
  loading="lazy"
/>
```

ただし、このプロジェクトでは表示サイズがほぼ固定なので、**Step 3 の固定幅指定だけで十分な効果**が得られる。`srcset` は費用対効果が低い。

## 期待される効果

### 転送サイズ削減

| 画像 | 元サイズ(1200px) | w=480 | 削減率 |
|------|------------------|-------|--------|
| 平均 | ~122KB | ~25-30KB | **約75%** |
| 合計(37枚) | 4.5MB | ~1.0MB | **約3.5MB削減** |

### Lighthouse スコアへの影響

- **LCP 改善**: Above the fold の画像転送量が減り描画が速くなる
- **FCP 改善**: 画像のダウンロード完了が早くなる
- 番組表の ~720 画像が全て 1200px → 150-200px 表示なので効果大

## VRT への影響

- 画像の縮小は `withoutEnlargement: true` で元サイズ以上にはしない
- JPEG quality 80 は視覚的に差異なし
- **VRT 通過のリスク**: 低い。ただし質を下げすぎると差異が出る可能性あり

## 将来の拡張（フォーマット変換対応時）

同じミドルウェアに `f` パラメータを追加:

```
/public/images/011.jpeg?w=480&f=webp
/public/images/011.jpeg?w=480&f=avif
```

クライアント側は `<picture>` 要素で:

```tsx
<picture>
  <source type="image/avif" srcSet={resizedImageUrl(url, 480, 'avif')} />
  <source type="image/webp" srcSet={resizedImageUrl(url, 480, 'webp')} />
  <img src={resizedImageUrl(url, 480)} alt="" loading="lazy" />
</picture>
```

## 実装優先度

1. ~~**sharp 導入**~~ ✅
2. ~~**ビルド時プリウォームスクリプト作成**（Step 2）~~ ✅
3. ~~**リサイズミドルウェア作成**（Step 3）~~ ✅
4. ~~**各コンポーネントに `?w=XXX` 付与**（Step 4）~~ ✅
5. WebP/AVIF 対応（別タスク）
6. srcset 対応（効果が限定的なため優先度低）

## 実装済み変更一覧

### 画像配置

リサイズ済み画像は `public/images/` に直接配置（事前生成済み、ビルド時の処理不要）。

- 命名規則: `{name}_w{width}.jpeg`（例: `001_w320.jpeg`）
- サイズ: 320 / 384 / 480 / 640 の4バリアント × 37枚 = 148枚
- 再生成が必要な場合: `pnpm --filter @wsh-2025/server run generate-images`

### 新規ファイル

| ファイル | 内容 |
|----------|------|
| `workspaces/server/tools/generate-resized-images.ts` | 画像リサイズユーティリティ。手動実行用（`pnpm --filter @wsh-2025/server run generate-images`） |
| `workspaces/server/src/image.ts` | `/public/images/:filename?w=XXX` ルートハンドラ。`public/images/` 内の事前生成ファイルを配信 |

### 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `package.json` | `pnpm.onlyBuiltDependencies` に `sharp` 追加 |
| `workspaces/server/package.json` | `sharp` を dependencies に追加。`generate-images` wireit コマンド追加（手動実行用） |
| `workspaces/server/src/index.ts` | `registerImageHandler` を `registerSsr` より前に登録 |

### クライアント側コンポーネント変更

| コンポーネント | ファイル | 変更 |
|----------------|----------|------|
| EpisodeItem | `client/src/features/recommended/components/EpisodeItem.tsx` | `src={episode.thumbnailUrl}` → `src={\`${episode.thumbnailUrl}?w=480\`}` |
| SeriesItem | `client/src/features/recommended/components/SeriesItem.tsx` | `src={series.thumbnailUrl}` → `src={\`${series.thumbnailUrl}?w=480\`}` |
| SeriesEpisodeItem | `client/src/features/series/components/SeriesEposideItem.tsx` | `src={episode.thumbnailUrl}` → `src={\`${episode.thumbnailUrl}?w=384\`}` |
| Program | `client/src/pages/timetable/components/Program.tsx` | `src={program.thumbnailUrl}` → `src={\`${program.thumbnailUrl}?w=320\`}` |
| ProgramDetailDialog | `client/src/pages/timetable/components/ProgramDetailDialog.tsx` | 2箇所とも `?w=640` 付与 |
| SeriesPage | `client/src/pages/series/components/SeriesPage.tsx` | `src={series.thumbnailUrl}` → `src={\`${series.thumbnailUrl}?w=640\`}` |
| EpisodePage | `client/src/pages/episode/components/EpisodePage.tsx` | 変更なし（max 1280px 表示のため元画像が適正） |

### 動作フロー

```
/public/images/011.jpeg?w=480 へのリクエスト
  → image.ts ミドルウェアが処理
  → public/images/011_w480.jpeg を検索
  → 存在すればストリーム配信、なければ元画像をフォールバック配信
```
