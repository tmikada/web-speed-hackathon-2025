# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

Web Speed Hackathon 2025の「AREMA」動画配信サービスのパフォーマンス最適化プロジェクト。

- **技術スタック**: React 19 + React Router 7 + Fastify + Webpack
- **評価基準**: Lighthouse + Puppeteer による独自スコアリング（1200点満点）
- **目標**: スコアの最大化とレギュレーション遵守

## アーキテクチャ

```
/workspaces
├── client/    # React 19 フロントエンド（Webpack）
├── server/    # Fastify SSRサーバー
├── schema/    # DB モデルと API インタフェース
├── configs/   # 設定ファイル群
└── test/      # E2E テストと VRT
```

## よく使うコマンド

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動
pnpm run dev

# ビルド
pnpm run build

# 本番サーバー起動
pnpm run start

# VRT（Visual Regression Test）実行
pnpm run build && pnpm run start
pnpm run test
```

## レギュレーション（厳守事項）
- [regulation.md](docs/regulation.md) を参照

## 採点方法
- [scoring.md](docs/scoring.md) を参照

## タスクスコープ

**このプロジェクトでは最適化タスクのみを行う。**

- パフォーマンス最適化のみに集中する
- 新機能の追加や機能変更は行わない
- レギュレーション違反となる変更は行わない
- 最適化後は必ずVRTを実行して動作確認する（手動で実行する）

## 最適化ポイント
対応内容ごとにドキュメントに整理して対応を進める。

詳細は以下およびdocs/featuresフォルダを参照。
-  [docs/optimization.md](docs/optimization.md) 
 - [docs/react-best-practices-analysis.md](docs/react-best-practices-analysis.md) 


## 変更時の注意

1. **変更前に必ず対象ファイルを読む**
2. **最小限の変更に留める**（過剰なリファクタリングは避ける）
3. **VRTでデザイン崩れがないか確認**
  - テスト結果はdocs/test-results配下にサマリーを格納する
4. **機能テストで動作確認**

## 主要ファイルの場所

- Webpack設定: `workspaces/client/webpack.config.mjs`
- SSR処理: `workspaces/server/src/ssr.tsx`
- キャッシュ設定: `workspaces/server/src/api.ts`
- ビデオプレイヤー: `workspaces/client/src/features/player/`
- UnoCSS設定: `workspaces/client/src/setups/unocss.ts`
