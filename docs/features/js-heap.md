# JS ヒープサイズの調査 (107MB)

---

## 1. 未使用のビデオプレイヤーライブラリ

**場所**: `workspaces/client/package.json`

実際に使用しているのは HLS.js のみだが、以下もバンドルに含まれる:

- `shaka-player` (~200KB)
- `video.js` (~300KB+)

推定: **約500KB+** の未使用 JavaScript

## 2. UnoCSS ランタイム + アイコンコレクション

**場所**: `workspaces/client/src/setups/unocss.ts`

- `@unocss/runtime` をブラウザで実行
- 4つのアイコンコレクションが SVG 文字列としてインライン化
- 推定: **80-160KB** のメモリ消費

## 3. 大量の DOM + Observer によるメモリ消費

7,581 DOM ノードと 7,733 イベントリスナーそのものが GC 対象外のメモリを占有。

詳細は以下を参照:
- [dom-nodes.md](dom-nodes.md)
- [event-listeners.md](event-listeners.md)

## 4. Store hydration の深いマージ — 対応済み

**場所**: `workspaces/client/src/app/createStore.ts`

`lodash/merge` による深いコピーを、手動の2階層シャローマージに置き換え済み。
- `lodash/merge` のインポートを削除しバンドルサイズを削減
- ディープコピーによる一時的なメモリ消費を解消

---

## 改善案

| 優先度 | 対策 | 効果 |
|--------|------|------|
| 1 | 未使用プレイヤーライブラリの除去 | バンドル 500KB+ 削減 |
| 2 | DOM / リスナー削減（他ドキュメント参照） | 間接的にヒープ削減 |
| 3 | UnoCSS をビルド時生成に変更 | ランタイムメモリ 80-160KB 削減 |
