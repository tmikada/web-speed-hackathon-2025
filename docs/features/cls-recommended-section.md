# CLS改善: おすすめセクション（recommended）

## 概要

ホームページのおすすめセクション（`RecommendedSection`）で大きな CLS が発生している。

| 要素 | クラス | CLSスコア |
|------|--------|-----------|
| JumbotronSection テキスト領域 | `grow-1 shrink-1 p-[24px]` | 0.139 |
| HomePage モジュールラッパー | `mb-[24px] px-[24px]` | 0.059 |
| HomePage モジュールラッパー | `mb-[24px] px-[24px]` | 0.053 |
| JumbotronSection テキスト領域 | `grow-1 shrink-1 p-[24px]` | 0.047 |
| JumbotronSection テキスト領域 | `grow-1 shrink-1 p-[24px]` | 0.003 |

---

## 原因1: カルーセル画像に aspect-ratio がない

**該当ファイル**:
- `workspaces/client/src/features/recommended/components/EpisodeItem.tsx:28`
- `workspaces/client/src/features/recommended/components/SeriesItem.tsx:24`

**問題**:
```tsx
<img alt="" className="h-auto w-full" src={episode.thumbnailUrl} loading="lazy" />
```

- `h-auto w-full` のみで `aspect-ratio` が未指定
- 画像読み込み前はコンテナ高さが 0 に潰れる
- 画像読み込み後にサムネイル分の高さが広がり、後続モジュール全体が下にシフト

```
初期表示:
[タイトル]
[img h=0][img h=0]     ← 画像未読込、高さ0
[次のモジュール]        ← 直上に配置

画像読み込み後:
[タイトル]
┌────┐ ┌────┐          ← 高さ確定
│    │ │    │
└────┘ └────┘
[次のモジュール]        ← ↓シフト発生
```

**修正**:
```tsx
// Before
<img alt="" className="h-auto w-full" .../>

// After
<img alt="" className="aspect-video h-auto w-full" .../>
```

`aspect-video` (= `aspect-ratio: 16/9`) でブラウザが読み込み前から正しい高さを予約する。

---

## 原因2: JumbotronSection の Player に幅が未指定

**該当ファイル**: `workspaces/client/src/features/recommended/components/JumbotronSection.tsx:46`

**問題**:
```tsx
<div className="h-full w-auto shrink-0 grow-0">
  <Player ... />
</div>
```

- 親 NavLink は `h-[260px]` で高さ固定だが、Player コンテナは `w-auto`
- 動画メタデータ読み込み前は幅が 0
- 読み込み後に動画固有幅に広がり、テキスト領域（`grow-1 shrink-1`）が縮む

```
初期（Player幅=0）:
┌──────────────────────────────┬──┐
│ テキスト（幅いっぱい）          │P │
└──────────────────────────────┴──┘

メタデータ読み込み後:
┌──────────────────┬───────────────┐
│ テキスト ← 縮小!  │ Player (462px) │
└──────────────────┴───────────────┘
```

**修正**:
```tsx
// Before
<div className="h-full w-auto shrink-0 grow-0">

// After
<div className="h-full aspect-video shrink-0 grow-0">
```

高さ260px × 16:9 = 幅約462px が初期描画時から確保される。

---

## 影響範囲

| ページ | モジュール数 | 影響度 |
|--------|------------|--------|
| ホーム | 複数 | **大** |
| シリーズ | 1 | 中 |
| エピソード | 1 | 中 |
| 番組 | 1 | 中 |

## VRTリスク

**低** — 最終的な見た目は変わらない（読み込み完了後と同じサイズを事前予約するだけ）。修正後にVRT実行で確認。
