# データベーススキーマ定義

## 使用技術

| 項目 | 技術 |
|------|------|
| ORM | Drizzle ORM v0.38.2 |
| DB | SQLite (Turso/LibSQL) |
| スキーマ定義 | `workspaces/schema/src/database/schema.ts` |
| マイグレーション | `workspaces/server/migrations/` |
| シードスクリプト | `workspaces/server/tools/seed.ts` |
| DB接続設定 | `workspaces/server/src/drizzle/database.ts` |

## ER図

```
stream (配信ストリーム)
  └─ 1:N → episode

series (シリーズ/作品)
  └─ 1:N → episode

episode (エピソード)
  ├─ N:1 → series
  ├─ N:1 → stream
  ├─ 1:N → program
  └─ 1:N → recommendedItem

channel (チャンネル)
  └─ 1:N → program

program (番組表)
  ├─ N:1 → channel
  └─ N:1 → episode

recommendedModule (おすすめモジュール)
  └─ 1:N → recommendedItem

recommendedItem (おすすめアイテム)
  ├─ N:1 → recommendedModule
  ├─ N:1 → series (nullable)
  └─ N:1 → episode (nullable)

user (ユーザー) ※独立テーブル
```

## テーブル定義

### stream — 動画ストリーム

HLS配信用のストリーム情報を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| numberOfChunks | integer | | HLSチャンク数 |

### series — シリーズ（作品）

動画コンテンツの作品単位の情報を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| title | text | NOT NULL | 作品名 |
| description | text | NOT NULL | あらすじ |
| thumbnailUrl | text | NOT NULL | サムネイル画像URL |

### episode — エピソード

シリーズ内の各エピソード情報を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| title | text | NOT NULL | エピソード名 |
| description | text | NOT NULL | 説明 |
| thumbnailUrl | text | NOT NULL | サムネイル画像URL |
| order | integer | NOT NULL | シリーズ内の順番 |
| seriesId | text | NOT NULL, FK → series.id | 所属シリーズ |
| streamId | text | NOT NULL, FK → stream.id | 配信ストリーム |
| premium | integer | | プレミアム限定フラグ（0/1） |

### channel — チャンネル

放送チャンネル情報を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| name | text | NOT NULL | チャンネル名（「ニュース」「アニメ」等） |
| logoUrl | text | NOT NULL | チャンネルロゴURL |

### program — 番組（放送スケジュール）

チャンネルごとの放送スケジュールを管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| title | text | NOT NULL | 番組名 |
| description | text | NOT NULL | 番組説明 |
| startAt | text (カスタム型) | | 開始時刻 |
| endAt | text (カスタム型) | | 終了時刻 |
| thumbnailUrl | text | NOT NULL | サムネイル画像URL |
| channelId | text | NOT NULL, FK → channel.id | 所属チャンネル |
| episodeId | text | NOT NULL, FK → episode.id | 関連エピソード |

> **時刻のカスタム型について**: DBには時刻部分のみ（`HH:mm:ss`）で保存される。読み出し時にDrizzleのカスタム型が当日の日付を付与してISO 8601形式に変換する。深夜0時超え（`00:00:00`）は翌日として処理される。

### recommendedModule — おすすめモジュール

トップページ等に表示するおすすめコンテンツのモジュール（枠）を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| order | integer | NOT NULL | 表示順 |
| title | text | NOT NULL | モジュールタイトル |
| referenceId | text | NOT NULL | 表示先ページ（後述） |
| type | text | NOT NULL | `"carousel"` または `"jumbotron"` |

**referenceId の値**:
- `"entrance"` — トップページに表示
- `"error"` — エラーページに表示
- series/episode/program の ID — 各詳細ページに表示

### recommendedItem — おすすめアイテム

おすすめモジュール内の個々のアイテムを管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | text | PK | UUID |
| order | integer | NOT NULL | モジュール内の表示順 |
| moduleId | text | NOT NULL, FK → recommendedModule.id | 所属モジュール |
| seriesId | text | FK → series.id (nullable) | 参照シリーズ |
| episodeId | text | FK → episode.id (nullable) | 参照エピソード |

> `seriesId` と `episodeId` は排他的に使用され、どちらか一方のみが設定される。

### user — ユーザー

認証用のユーザー情報を管理する。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | integer | PK, 自動採番 | ユーザーID |
| email | text | NOT NULL, UNIQUE | メールアドレス |
| password | text | NOT NULL | bcryptハッシュ化パスワード |

## 設計上の特徴

- **UUID文字列キー**: `user`以外はすべてUUID文字列をPKに使用
- **ポリモーフィックな推薦**: `recommendedModule.referenceId`がページ種別とコンテンツIDを兼用
- **SQLiteのboolean**: `episode.premium`はinteger(0/1)で格納（SQLiteの慣例）
- **カスタム時刻型**: `program`の時刻カラムは時刻のみ保存し、実行時に日付を付与する独自実装

## シードデータ

シードスクリプト（`workspaces/server/tools/seed.ts`）により以下のデータが生成される:

- **series**: 30作品
- **episode**: 各シリーズ10〜20話
- **channel**: 12チャンネル
- **program**: 各チャンネルの1日分スケジュール
- **recommendedModule / recommendedItem**: トップページ用おすすめコンテンツ
- **user**: テストユーザー 1件（`test@example.com` / `test`）

## マイグレーション履歴

| # | ファイル | 内容 |
|---|---------|------|
| 0000 | `fluffy_calypso.sql` | 初期スキーマ作成（channel, episode, program, recommendedItem, recommendedModule, series, stream） |
| 0001 | `sparkling_dragon_lord.sql` | userテーブル追加、emailユニーク制約 |
| 0002 | `bizarre_johnny_storm.sql` | program.startAt/endAtをintegerからtextに変更 |
| 0003 | `loud_kang.sql` | episode.premiumカラム追加 |
| 0004 | `abnormal_network.sql` | userインデックス再作成、timestampカラム確認 |
