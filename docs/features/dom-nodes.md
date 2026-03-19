# DOM ノード過多の調査 (7,581)

Lighthouse 推奨上限: 1,500 以下 → 現状 **約5倍**

---

## 1. 番組表ページ（最大の原因）

**場所**: `workspaces/client/src/pages/timetable/components/`

- 12チャンネル x 約60番組 = **約720個の Program コンポーネント**を全件レンダリング
- 仮想スクロールなし
- 1 Program あたり約18 DOM ノード（wrapper, button, div x5, Ellipsis, img 等）
- 推定: 720 x 18 = **約12,960ノード**

```
TimetablePage
  └─ ChannelTitle (x12)
  └─ ProgramList (x12)
     └─ Program (x~60/チャンネル = ~720)
        ├─ Hoverable wrapper
        ├─ Button + 子 div x5
        ├─ Ellipsis (react-ellipsis-component)
        └─ Image
```

### 対応: IntersectionObserver による遅延レンダリング（実施済み）

**変更ファイル**: `workspaces/client/src/pages/timetable/components/Program.tsx`

#### 問題の詳細

元のコードでは IntersectionObserver を画像の `src` 遅延設定にしか使っておらず、
画面外の番組でも Hoverable, button, Ellipsis, img 等 **約18個の DOM ノードが全て生成**されていた。

#### 変更内容

コンポーネントを2層に分割:

1. **`Program`（外側）** — IntersectionObserver でビューポート判定
   - `isInView = false`: 高さ・幅だけ維持した **`<button>` 1個**（プレースホルダー、`aria-label` でタイトル付与、クリックで `isInView` を `true` に切替）
   - `isInView = true`: `ProgramContent` をレンダリング（一度表示したら `unobserve` で永続化）

2. **`ProgramContent`（内側）** — 元の Program の全ロジック・全DOM
   - hooks（useCurrentUnixtimeMs, useSelectedProgramId 等）はここで呼ぶ
   - 条件分岐の後なので hooks のルール違反にならない

```
改善前:
  Program (x720)
    ├─ hooks 全部実行
    ├─ IntersectionObserver → 画像srcのみ制御
    └─ DOM 18ノード全生成

改善後:
  Program (x720)
    ├─ IntersectionObserver → ビューポート判定
    ├─ [画面外] → <button> 1ノードのみ（プレースホルダー、aria-label付き）
    └─ [画面内] → ProgramContent
                    ├─ hooks 実行
                    └─ DOM 18ノード生成
```

#### 期待効果

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| 画面内の番組 | 720個 x 18ノード | ~96個 x 18ノード |
| 画面外の番組 | 720個 x 18ノード（重複） | ~624個 x 1ノード |
| 番組表の合計DOM | ~12,960 | ~2,352 |
| **削減数** | — | **約10,600ノード** |

#### VRT への影響

- 番組表VRTは初期表示領域のスクリーンショット → 画面外の非レンダリングは影響なし
- プレースホルダーは元と同じ `border` + `bg-[#212121]` スタイル → 視覚的に同一

#### 注意事項

- `useCurrentUnixtimeMs` の250msポーリングは `ProgramContent` 内に閉じているため、
  画面外の番組では再レンダリングが発生しない（パフォーマンス二重改善）
- スクロールで一度表示された番組は `unobserve` により永続化されるため、
  スクロールバック時にプレースホルダーに戻ることはない

## 2. ホームページのカルーセル

**場所**: `workspaces/client/src/features/recommended/components/`

- 約20モジュール x 15-20アイテム = **約340個の EpisodeItem/SeriesItem**
- 各アイテム約16ノード（NavLink, Flipped, div, img, icon, metadata 等）
- 推定: 340 x 16 = **約5,440ノード**

#### 1アイテムあたりの DOM ノード内訳（EpisodeItem の場合）

| 要素 | ノード数 | 説明 |
|------|---------|------|
| Hoverable | 1 | ホバー状態管理のラッパー |
| NavLink | 1 | リンク（`<a>`タグ） |
| Flipped + div | 2 | react-flip-toolkit アニメーション + 画像コンテナ |
| `<img>` | 1 | サムネイル画像 |
| play icon `<span>` | 1 | 再生アイコン（UnoCSS） |
| premium badge `<span>` | 1 | プレミアムバッジ（条件付き） |
| メタデータ `<div>` x3 | 3 | p-[8px]コンテナ + タイトル用div + シリーズ名用div |
| Ellipsis x2 | ~6 | react-ellipsis-component（内部で各3ノード程度） |
| **合計** | **~16** | |

#### 問題の本質

画面に見えているのは **2〜3モジュール × 3〜4アイテム = 6〜12アイテム分** だが、
約20モジュール × 15〜20アイテム = **300〜400アイテム分が全て即時レンダリング**されている。

```
可視: モジュール2〜3個 × アイテム3〜4個 = 6〜12アイテム分
生成: モジュール20個 × アイテム15〜20個 = 300〜400アイテム分
→ 95%以上のDOMが画面外
```

### 対応（段階1）: モジュール単位の遅延レンダリング（実施済み）

**変更ファイル**: `workspaces/client/src/pages/home/components/HomePage.tsx`

#### 変更内容

`LazyModule` コンポーネントを追加し、各モジュールを IntersectionObserver で遅延レンダリング:

1. **`LazyModule`（外側）** — IntersectionObserver でビューポート判定
   - `isInView = false`: `minHeight: 280px` のプレースホルダー `<div>` 1個のみ
   - `isInView = true`: `RecommendedSection` をフルレンダリング（`unobserve` で永続化）

2. **`RecommendedSection`（内側）** — 元のモジュール描画ロジック
   - CarouselSection / JumbotronSection の振り分け
   - `isInView = true` のときだけマウントされる

```
改善前:
  HomePage
    └─ modules.map (x20) ← 全件即時レンダリング
       └─ RecommendedSection
          └─ CarouselSection (各~280ノード)

改善後:
  HomePage
    └─ modules.map (x20)
       └─ LazyModule
          ├─ [画面外] → <div> 1ノード（プレースホルダー）
          └─ [画面内] → RecommendedSection
                         └─ CarouselSection (各~280ノード)
```

#### 期待効果

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| 画面内のモジュール | 20個 x ~280ノード | ~3個 x ~280ノード |
| 画面外のモジュール | — | ~17個 x 1ノード |
| カルーセル合計DOM | ~5,440 | ~857 |
| **削減数** | — | **約4,580ノード** |

#### VRT への影響

- トップページVRTは初期表示領域のスクリーンショット → 画面外の非レンダリングは影響なし
- プレースホルダーは背景色なし（元の背景と同一）→ 視覚的に同一

#### 注意事項

- `minHeight: 280px` はカルーセルの概算高さ（h2 + 横スクロール領域）
  正確な高さではないが、IntersectionObserver のトリガーには十分
- JumbotronSection 内の動画プレイヤーは画面外ではマウントされないため、
  不要なHLS接続が削減される（帯域・CPU二重改善）
- スクロールで一度表示されたモジュールは `unobserve` により永続化

### 対応（段階2）: カルーセル内アイテムの遅延レンダリング（実施済み）

**変更ファイル**: `workspaces/client/src/features/recommended/components/CarouselSection.tsx`

#### 整合性の検討

- **`useScrollSnap`**: `children` の `offsetLeft` を読んでスナップ位置を計算する。
  → ラッパー `<div>` のサイズ（`width`）は維持するため `offsetLeft` は正しく算出される。**影響なし**。
- **`ElementScrollRestoration`**: コンテナの `scrollLeft` を保存・復元する。
  → ラッパー `<div>` が同じ幅で存在するため、スクロール位置の計算に影響なし。**影響なし**。

#### 変更内容

`LazyCarouselItem` コンポーネントを追加:

1. **ラッパー `<div>`（常にレンダリング）** — 固定 `width` で `offsetLeft` を維持
   - `useScrollSnap` / `ElementScrollRestoration` の動作を保証
2. **中身（`isInView` 時のみレンダリング）** — `EpisodeItem` / `SeriesItem`
   - `isInView = false`: ラッパー div のみ（中身は空、~16ノード削減）
   - `isInView = true`: フルレンダリング（`unobserve` で永続化）

```
改善前:
  CarouselSection
    └─ items.map (x15-20) ← 全件即時レンダリング
       └─ div(wrapper) + EpisodeItem/SeriesItem (~16ノード)

改善後:
  CarouselSection
    └─ items.map (x15-20)
       └─ LazyCarouselItem
          └─ div(wrapper, 固定width) ← 常にレンダリング
             ├─ [画面外] → 中身なし（1ノード）
             └─ [画面内] → EpisodeItem/SeriesItem (~16ノード)
```

#### 期待効果（段階1と合算）

| 項目 | 段階1のみ | 段階1+2 |
|------|----------|---------|
| 画面内モジュール ~3個 | ~3 x ~280ノード = ~840 | ~3 x (5コンテナ + 4可視アイテム x 16) = ~207 |
| 画面外モジュール ~17個 | ~17 x 1 = ~17 | ~17 x 1 = ~17 |
| **カルーセル合計DOM** | **~857** | **~224** |
| 段階2による追加削減 | — | **約630ノード** |

#### 注意事項

- ラッパー `<div>` は高さを明示していない（`aspect-video` の画像でコンテンツ依存）ため、
  未表示時は高さ0になる。ただし横スクロールのカルーセルでは縦の高さ崩れは問題にならない
  （コンテナの高さは可視アイテムが決定する）
- 段階1で画面外モジュールはそもそもマウントされないため、段階2の効果は
  **画面内の2〜3モジュール内の非可視アイテム**に限定される

## 3. エピソード一覧

**場所**: `workspaces/client/src/features/series/components/SeriesEpisodeList.tsx`

- 30シリーズ x 10-20エピソード = 最大約450アイテム

---

## 改善案（残り）

| 優先度 | 対策 | 効果 | 状態 |
|--------|------|------|------|
| 1 | 番組表の遅延レンダリング | ~10,600ノード削減 | **実施済み** |
| 2 | カルーセルの遅延レンダリング・段階1（画面外モジュール非描画） | ~4,580ノード削減 | **実施済み** |
| 2b | カルーセルの遅延レンダリング・段階2（横スクロール内アイテム非描画） | ~630ノード削減 | **実施済み** |
| 3 | エピソード一覧の仮想化 | シリーズページの DOM 削減 | 未着手 |
