# 番組表プレースホルダーのボタン化

## 概要

番組表の DOM ノード削減で導入した IntersectionObserver 遅延レンダリングにおいて、
ビューポート外のプレースホルダーを `<div>` から `<button>` に変更し、
スコアリングツールのユーザーフロー計測に対応した。

## 背景・問題

### スコアリングテストの失敗

スコアリング計測 #3 で「番組表 → モーダル → 番組 → 関連エピソード」フローが計測不可となった。

**エラー**: `番組表から指定された番組への遷移に失敗しました`

### 原因

スコアリングツールは以下の手順で操作を行う:

1. 時刻を22:30にモックして `/timetable` に遷移
2. `getByRole('button', { name: /働きマン 第6話/ })` でボタンを検索（10秒タイムアウト）
3. ボタンをクリック → ダイアログで「番組をみる」リンクをクリック

DOM ノード削減（コミット `edbf95e`）により、ビューポート外の番組は `<div>` プレースホルダーのみレンダリングされるようになった。「働きマン 第6話」がビューポート外にある場合、`role="button"` を持つ要素が DOM に存在せず、テストがタイムアウトしていた。

## 対応内容

**変更ファイル**: `workspaces/client/src/pages/timetable/components/Program.tsx`

### 変更箇所

`Program` コンポーネントの `isInView === false` 時のプレースホルダーを変更:

```tsx
// 変更前
if (!isInView) {
  return (
    <div
      ref={placeholderRef}
      className="border-[1px] border-solid border-[#000000] bg-[#212121]"
      style={{ width, height: `${height}px` }}
    />
  );
}

// 変更後
if (!isInView) {
  return (
    <button
      ref={placeholderRef}
      aria-label={program.title}
      className="border-[1px] border-solid border-[#000000] bg-[#212121] text-left"
      style={{ width, height: `${height}px` }}
      type="button"
      onClick={() => setIsInView(true)}
    />
  );
}
```

### ポイント

| 項目 | 内容 |
|------|------|
| `<button>` | `getByRole('button')` でマッチ可能に |
| `aria-label={program.title}` | `{ name: /働きマン 第6話/ }` でタイトル検索可能に |
| `onClick={() => setIsInView(true)}` | クリックで `ProgramContent` をレンダリングし、ダイアログ等の操作を可能にする |
| `text-left` | `<button>` デフォルトの `text-align: center` を上書きし、見た目を維持 |

## DOM ノード削減への影響

- プレースホルダーは依然として **1ノード**（`<div>` → `<button>` に変わっただけ）
- DOM ノード削減の効果は維持される（約10,600ノード削減）

## VRT への影響

- `<button>` は `<div>` と同じスタイルを持つため、視覚的に同一
- `text-left` の追加により、将来テキストが表示される場合も左寄せが維持される
