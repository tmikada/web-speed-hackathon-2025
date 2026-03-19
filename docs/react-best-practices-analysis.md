# React Best Practices 解析レポート

Vercel React Best Practicesガイドラインに基づくコードベース解析結果

**解析日**: 2026-02-11
**対象**: `/workspaces/client/src/`

---

## 目次

1. [CRITICAL: 非同期処理のウォーターフォール問題](#1-critical-非同期処理のウォーターフォール問題)
2. [CRITICAL: バンドルサイズ最適化](#2-critical-バンドルサイズ最適化)
3. [HIGH: 再レンダリング最適化](#3-high-再レンダリング最適化)
4. [MEDIUM: レンダリングパフォーマンス](#4-medium-レンダリングパフォーマンス)
5. [LOW: JavaScript パフォーマンス](#5-low-javascript-パフォーマンス)
6. [Webpack/ビルド設定の問題](#6-webpackビルド設定の問題)
7. [優先度別サマリー](#7-優先度別サマリー)

---

## 1. CRITICAL: 非同期処理のウォーターフォール問題

### 1.1 prefetch関数での逐次データフェッチ

**違反ルール**: `async-parallel` (独立した処理にPromise.all()を使用)

**対象ファイル**:
- `workspaces/client/src/pages/program/components/ProgramPage.tsx` (Lines 20-34)
- `workspaces/client/src/pages/timetable/components/TimetablePage.tsx` (Lines 12-19)
- `workspaces/client/src/pages/episode/components/EpisodePage.tsx` (Lines 20-27)
- `workspaces/client/src/pages/series/components/SeriesPage.tsx` (Lines 12-18)

**問題のあるコード** (ProgramPage.tsx):
```typescript
export const prefetch = async (store: ReturnType<typeof createStore>, { programId }: Params) => {
  // これらは逐次実行される - ウォーターフォール!
  const program = await store.getState().features.program.fetchProgramById({ programId });
  const channels = await store.getState().features.channel.fetchChannels();
  const timetable = await store.getState().features.timetable.fetchTimetable({ since, until });
  const modules = await store.getState().features.recommended.fetchRecommendedModulesByReferenceId({ referenceId: programId });
  return { channels, modules, program, timetable };
};
```

**修正方法**:
```typescript
export const prefetch = async (store: ReturnType<typeof createStore>, { programId }: Params) => {
  const [program, channels, timetable, modules] = await Promise.all([
    store.getState().features.program.fetchProgramById({ programId }),
    store.getState().features.channel.fetchChannels(),
    store.getState().features.timetable.fetchTimetable({ since, until }),
    store.getState().features.recommended.fetchRecommendedModulesByReferenceId({ referenceId: programId }),
  ]);
  return { channels, modules, program, timetable };
};
```

**影響**: ページロードが2-10倍遅くなる。各awaitがフルネットワークラウンドトリップ遅延を追加。

---

## 2. CRITICAL: バンドルサイズ最適化

### 2.1 LimitChunkCountPluginによるコード分割の無効化

**違反ルール**: `bundle-dynamic-imports`

**ファイル**: `workspaces/client/webpack.config.mjs` (Line 62)

```javascript
plugins: [
  new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }), // コード分割を無効化!
]
```

**影響**: すべてのJavaScriptが一括でロードされ、TTIとLCPが大幅に増加。

**修正**: このプラグインを削除する。

---

### 2.2 複数のビデオプレイヤーが同時にバンドル

**違反ルール**: `bundle-conditional-loading`

**ファイル**: `workspaces/client/src/features/player/logics/create_player.ts` (Lines 1-4)

```typescript
import '@videojs/http-streaming';
import HlsJs from 'hls.js';
import shaka from 'shaka-player';
import videojs from 'video.js';
```

**問題**: 3つのビデオプレイヤー（Shaka, HLS.js, Video.js）がすべて即座にインポートされているが、実際には`PlayerType`に基づいて1つしか使用されない。各プレイヤーは100-300KB。

**影響**: ~500KB以上の不要なJavaScriptがバンドル。

**修正**: 動的インポートを使用して必要なプレイヤーのみをロード。

---

### 2.3 Lodashライブラリ全体のインポート

**違反ルール**: `bundle-barrel-imports`

**ファイル**: `workspaces/client/src/app/createStore.ts` (Line 2)

```typescript
import _ from 'lodash';  // ~70KB
```

**問題**: `_.merge()`のためだけにLodash全体（~70KB）をインポート。

**修正**:
```typescript
import merge from 'lodash/merge';
```

---

### 2.4 core-jsポリフィル全体のインポート

**違反ルール**: `bundle-barrel-imports`

**ファイル**: `workspaces/client/src/setups/polyfills.ts` (Line 1)

```typescript
import 'core-js';  // ~100KB+
```

**影響**: 100KB以上の未使用ポリフィルコード。

**修正**: Babel設定で`useBuiltIns: 'usage'`を使用。

---

### 2.5 UnoCSS Runtimeでの動的アイコン読み込み

**違反ルール**: `bundle-defer-non-critical`

**ファイル**: `workspaces/client/src/setups/unocss.ts` (Lines 1-72)

```typescript
presetIcons({
  collections: {
    bi: () => import('@iconify/json/json/bi.json').then((m) => m.default),
    bx: () => import('@iconify/json/json/bx.json').then((m) => m.default),
    // ... 実行時に動的インポート
  },
}),
```

**影響**: 各アイコンコレクションが実行時に別のネットワークリクエスト。

**修正**: ビルド時に静的生成。

---

### 2.6 ルート遅延読み込みの人工的な遅延

**ファイル**: `workspaces/client/src/app/createRoutes.tsx` (Lines 1, 14-17)

```typescript
import lazy from 'p-min-delay';
...
const { HomePage, prefetch } = await lazy(
  import('@wsh-2025/client/src/pages/home/components/HomePage'),
  1000,  // 1秒の人工的な遅延!
);
```

**影響**: すべてのページナビゲーションが最低1秒遅くなる。

**修正**: `p-min-delay`を削除し、通常の動的インポートを使用。

---

## 3. HIGH: 再レンダリング最適化

### 3.1 パッシブイベントリスナーの欠如

**違反ルール**: `client-passive-listeners`

**ファイル**: `workspaces/client/src/features/layout/components/Layout.tsx` (Lines 37-46)

```typescript
useEffect(() => {
  const handleScroll = () => {
    setScrollTopOffset(window.scrollY);
  };
  window.addEventListener('scroll', handleScroll);  // { passive: true } がない
  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}, []);
```

**修正**:
```typescript
window.addEventListener('scroll', handleScroll, { passive: true });
```

---

### 3.2 useStoreで全ステート選択

**違反ルール**: `rerender-derived-state`

**対象ファイル**:
- `workspaces/client/src/features/auth/hooks/useAuthActions.ts` (Line 4)
- `workspaces/client/src/features/layout/hooks/usePointer.ts` (Lines 3-5)
- `workspaces/client/src/pages/timetable/hooks/useCurrentUnixtimeMs.ts` (Line 6)
- `workspaces/client/src/pages/timetable/hooks/useColumnWidth.ts` (Line 5)

```typescript
const state = useStore((s) => s);  // ステートツリー全体をサブスクライブ
```

**問題**: `(s) => s`でステート全体を選択すると、ストア内の任意のステート変更で再レンダリング。

**修正**: 必要なステートのみを選択:
```typescript
const closeDialog = useStore((s) => s.features.auth.closeDialog);
```

---

### 3.3 過剰なsetIntervalポーリング

**違反ルール**: `rerender-transitions`

**対象ファイル**:
- `workspaces/client/src/pages/timetable/hooks/useCurrentUnixtimeMs.ts` (Lines 7-14)
- `workspaces/client/src/features/recommended/hooks/useCarouselItemWidth.ts` (Lines 12-18)
- `workspaces/client/src/pages/timetable/components/Program.tsx` (Lines 38-46)

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    state.pages.timetable.refreshCurrentUnixtimeMs();
  }, 250);  // 毎秒4回ステート更新!
  return () => clearInterval(interval);
}, []);
```

**影響**: 継続的なCPU使用と再レンダリング。

**修正**: `startTransition()`を使用するか、更新頻度を下げる。

---

### 3.4 setImmediateによる無限ループ

**違反ルール**: `rerender-transitions`

**ファイル**: `workspaces/client/src/features/layout/hooks/useSubscribePointer.ts` (Lines 8-29)

```typescript
let immediate = setImmediate(function tick() {
  s.features.layout.updatePointer({ ...current });
  immediate = setImmediate(tick);  // 可能な限り高速に実行!
});
```

**影響**: ポインターが移動していなくても継続的なステート更新。CPUスラッシング。

**修正**: `mousemove`イベントリスナーに変更し、更新をスロットル/デバウンス。

---

## 4. MEDIUM: レンダリングパフォーマンス

### 4.1 Hoverableコンポーネントの継続的なポインター追跡

**ファイル**: `workspaces/client/src/features/layout/components/Hoverable.tsx` (Lines 15-39)

```typescript
export const Hoverable = (props: Props) => {
  const pointer = usePointer();  // すべてのポインター更新で再レンダリング
  const elementRect = elementRef.current?.getBoundingClientRect();

  const hovered =
    elementRect != null &&
    elementRect.left <= pointer.x &&
    pointer.x <= elementRect.right &&
    elementRect.top <= pointer.y &&
    pointer.y <= elementRect.bottom;
};
```

**問題**: すべての`Hoverable`コンポーネントがグローバルポインターステートをサブスクライブし、各更新で`getBoundingClientRect()`を呼び出す。タイムテーブルページに多数の`Hoverable`がある場合、深刻なパフォーマンス問題を引き起こす。

**影響**: 指数的な再レンダリング。

**修正**: ネイティブCSS `:hover`を使用。

---

### 4.2 FFmpegの重いクライアントサイド処理

**違反ルール**: `bundle-dynamic-imports`

**ファイル**: `workspaces/client/src/pages/episode/hooks/useSeekThumbnail.ts` (Lines 1-76)

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
...
const ffmpeg = new FFmpeg();
await ffmpeg.load({
  coreURL: await import('@ffmpeg/core?arraybuffer').then(...)
  wasmURL: await import('@ffmpeg/core/wasm?arraybuffer').then(...)
});
```

**問題**: FFmpeg (~2MB WASM) がクライアントサイドでロードされ、重いビデオ処理が実行される。

**影響**: 巨大なバンドルサイズとCPU集約的なクライアントサイド処理。

**修正**: サーバーサイドで処理するか、事前計算。

---

## 5. LOW: JavaScript パフォーマンス

### 5.1 RegExpのホイスト

**違反ルール**: `js-hoist-regexp`

**ファイル**: `workspaces/client/src/features/auth/logics/isValidEmail.ts` (Lines 1-3)

```typescript
export const isValidEmail = (email: string): boolean => {
  return /^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i.test(email);
};
```

**修正**:
```typescript
const EMAIL_REGEX = /^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email);
```

---

### 5.2 DateTime操作のキャッシュ

**違反ルール**: `js-cache-repeated-calls`

**ファイル**: `workspaces/client/src/pages/timetable/components/Program.tsx` (Lines 28-32)

```typescript
const isBroadcasting =
  DateTime.fromISO(program.startAt).toMillis() <= DateTime.fromMillis(currentUnixtimeMs).toMillis() &&
  DateTime.fromMillis(currentUnixtimeMs).toMillis() < DateTime.fromISO(program.endAt).toMillis();
```

**問題**: 同じ値に対して`DateTime.fromISO()`が複数回呼び出される。

**修正**: 変数にキャッシュ。

---

### 5.3 ソート配列のメモ化

**違反ルール**: `js-toSorted`

**ファイル**: `workspaces/client/src/features/series/components/SeriesEpisodeList.tsx` (Lines 15-18)

```typescript
const orderedEpisodes = [...episodes].sort((a, b) => a.order - b.order);
```

**修正**: `useMemo`を使用:
```typescript
const orderedEpisodes = useMemo(
  () => [...episodes].sort((a, b) => a.order - b.order),
  [episodes]
);
```

---

## 6. Webpack/ビルド設定の問題

### 6.1 本番環境で開発モード

**ファイル**: `workspaces/client/webpack.config.mjs` (Line 9)

```javascript
mode: 'none',  // 'production'であるべき
```

**影響**: バンドルが圧縮・最適化されない。

---

### 6.2 ポリフィル設定が最適でない

**ファイル**: `workspaces/client/webpack.config.mjs` (Lines 22-29)

```javascript
useBuiltIns: 'entry',  // 'usage'であるべき
```

**影響**: 不要なポリフィルコードが含まれる。

---

## 7. 優先度別サマリー

### CRITICAL（即座に修正）:
| # | 問題 | ファイル |
|---|------|----------|
| 1 | LimitChunkCountPluginがコード分割を無効化 | webpack.config.mjs:62 |
| 2 | prefetch関数での逐次データフェッチ | 複数のページファイル |
| 3 | ルート読み込みの1000ms人工遅延 | createRoutes.tsx |
| 4 | ポインター追跡のsetImmediate無限ループ | useSubscribePointer.ts |
| 5 | Hoverableによる指数的再レンダリング | Hoverable.tsx |
| 6 | Webpack mode: 'none' | webpack.config.mjs:9 |
| 7 | 全ビデオプレイヤーが同時バンドル | create_player.ts |
| 8 | FFmpegのクライアントサイド重い処理 | useSeekThumbnail.ts |

### HIGH（高優先度）:
| # | 問題 | ファイル |
|---|------|----------|
| 9 | Lodash全体のインポート | createStore.ts:2 |
| 10 | core-jsポリフィル全体のインポート | polyfills.ts:1 |
| 11 | UnoCSS Runtimeで動的アイコン | unocss.ts |
| 12 | useBuiltIns: 'entry' | webpack.config.mjs:28 |
| 13 | ポーリングによる継続的再レンダリング | 複数のhooks |

### MEDIUM（中優先度）:
| # | 問題 | ファイル |
|---|------|----------|
| 14 | useStoreで全ステート選択 | 複数のhookファイル |
| 15 | パッシブイベントリスナーの欠如 | Layout.tsx |
| 16 | スクロールベースのステートで不要な再レンダリング | Layout.tsx |

### LOW（低優先度）:
| # | 問題 | ファイル |
|---|------|----------|
| 17 | RegExpのホイスト | isValidEmail.ts |
| 18 | DateTime操作のキャッシュ | Program.tsx |
| 19 | ソート配列のメモ化 | SeriesEpisodeList.tsx |

---

## 最もインパクトのある最適化トップ6

1. **LimitChunkCountPluginを削除してコード分割を有効化**
2. **Promise.all()でデータフェッチを並列化**
3. **1000msの人工遅延を削除**
4. **Webpackをproductionモードに設定**
5. **ポインター追跡の無限ループを修正**
6. **HoverableをCSS :hoverに置き換え**
