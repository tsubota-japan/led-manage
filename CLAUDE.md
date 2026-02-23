# LED Display Management System - CLAUDE.md

このファイルはプロジェクトの技術仕様・設計方針をまとめたものです。
コード変更のたびに最新の状態に更新してください。

---

## 概要

複数のディスプレイに画像・動画をループ再生させる管理システム。
- **管理画面**（`/admin`）: グループ・ファイル・スケジュール・ディスプレイの管理
- **表示画面**（`/display/[code]`）: フルスクリーン再生（ブラウザで開く）

---

## 技術スタック

| カテゴリ | ライブラリ / バージョン |
|---|---|
| フレームワーク | Next.js 16.1.6 (App Router) |
| 言語 | TypeScript 5 |
| スタイル | Tailwind CSS 4 |
| ORM | Prisma 5.22.0 |
| DB | SQLite (`prisma/dev.db`) |
| ドラッグ&ドロップ | @dnd-kit/core 6, @dnd-kit/sortable 10, @dnd-kit/utilities 3 |
| ファイルアップロード | formidable 3 |
| スケジューラー | node-cron 4 |
| ID生成 | nanoid 5 |
| ランタイム | Node.js 20 |

> **注意**: Prisma 7 は datasource の `url` 設定方法が破壊的変更されたため **Prisma 5** を使用する。

---

## ディレクトリ構成

```
led-manage/
├── CLAUDE.md                         # このファイル
├── .env                              # DATABASE_URL="file:./dev.db"
├── next.config.ts                    # instrumentationHook は Next.js 14+ でデフォルト有効
├── instrumentation.ts                # サーバー起動時に scheduler を初期化
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   └── uploads/                      # アップロードファイルの保存先（静的配信）
├── app/
│   ├── layout.tsx                    # ルートレイアウト（フォント等なし）
│   ├── page.tsx                      # / → /admin にリダイレクト
│   ├── globals.css                   # Tailwind import + リセット
│   ├── admin/
│   │   ├── layout.tsx                # サイドバー付きレイアウト（use client）
│   │   ├── page.tsx                  # ダッシュボード（ディスプレイ一覧）
│   │   ├── displays/page.tsx         # ディスプレイ管理
│   │   ├── files/page.tsx            # ファイル管理
│   │   ├── groups/page.tsx           # グループ一覧
│   │   └── groups/[id]/page.tsx      # グループ編集（dnd-kit）
│   │   └── schedules/page.tsx        # スケジュール管理
│   ├── display/
│   │   └── [code]/page.tsx           # フルスクリーン表示ページ（Server Component）
│   └── api/
│       ├── files/route.ts            # GET（一覧）, POST（アップロード）
│       ├── files/[id]/route.ts       # DELETE
│       ├── groups/route.ts           # GET, POST
│       ├── groups/[id]/route.ts      # GET, PUT, DELETE
│       ├── groups/[id]/files/route.ts # PUT（並び替え）, POST（追加）
│       ├── schedules/route.ts        # GET, POST
│       ├── schedules/[id]/route.ts   # PUT, DELETE
│       ├── displays/route.ts         # GET, POST
│       ├── displays/[id]/route.ts    # PUT, DELETE
│       └── sse/[code]/route.ts       # SSE エンドポイント
├── components/
│   └── display/
│       └── DisplayPlayer.tsx         # SSE受信 → ループ再生（use client）
└── lib/
    ├── prisma.ts                     # PrismaClient シングルトン
    ├── sse-manager.ts                # SSE接続レジストリ + 優先度ロジック
    └── scheduler.ts                  # node-cron スケジューラー
```

---

## データベーススキーマ

### File
| カラム | 型 | 説明 |
|---|---|---|
| id | String (cuid) | PK |
| name | String | 元のファイル名 |
| path | String (unique) | `/uploads/xxx.jpg` 形式 |
| mimeType | String | `image/*` / `video/*` |
| size | Int | バイト数 |
| createdAt | DateTime | |

### Group
| カラム | 型 | 説明 |
|---|---|---|
| id | String (cuid) | PK |
| name | String | グループ名 |
| createdAt / updatedAt | DateTime | |

### GroupFile（中間テーブル）
| カラム | 型 | 説明 |
|---|---|---|
| id | String (cuid) | PK |
| groupId | String | FK → Group (Cascade) |
| fileId | String | FK → File (Cascade) |
| order | Int | 表示順（0始まり） |
| duration | Int? | 画像の表示秒数（null = デフォルト5秒） |

### Schedule
| カラム | 型 | 説明 |
|---|---|---|
| id | String (cuid) | PK |
| groupId | String | FK → Group (Cascade) |
| startTime | DateTime | 発火時刻 |
| repeat | String | `none` / `daily` / `weekly` |
| priority | Int | 優先度（高いほど割り込み優先、デフォルト0） |
| active | Boolean | 有効/無効フラグ |

### Display
| カラム | 型 | 説明 |
|---|---|---|
| id | String (cuid) | PK |
| name | String | ディスプレイ名 |
| code | String (unique) | ランダム6文字（大文字英数字） |

---

## 主要コンポーネントの設計

### SSE Manager (`lib/sse-manager.ts`)
- モジュールレベルの `Map<code, SSEClient>` でSSE接続を管理
- `registerClient(code, controller)` / `unregisterClient(code)`
- `pushToDisplay(code, groupId, priority)` — `priority >= currentPriority` の時のみ送信
- `broadcastToAll(groupId, priority)` — 全ディスプレイに送信
- `isConnected(code)` — オンライン/オフライン判定

### Scheduler (`lib/scheduler.ts` + `instrumentation.ts`)
- node-cron で毎分実行
- `startTime` が「現在時刻から1分以内」のアクティブスケジュールを検索して発火
- `repeat=daily` → startTime を +1日に更新
- `repeat=weekly` → startTime を +7日に更新
- `repeat=none` → `active=false` に更新
- `instrumentation.ts` の `register()` 関数（Node.js ランタイムのみ）で初期化

### DisplayPlayer (`components/display/DisplayPlayer.tsx`)
- SSE 接続（`/api/sse/[code]`）で `play` イベント受信
- `groupId` を受け取り → `/api/groups/[id]` でファイル一覧を fetch
- 画像: `setTimeout(advance, duration * 1000)`（duration null 時は 5 秒）
- 動画: `<video onEnded={advance} />`
- 末尾まで到達で index=0 に戻り永久ループ

### ファイルアップロード (`app/api/files/route.ts`)
- formidable でmultipart 解析
- `public/uploads/` に `nanoid()` ベースのファイル名で保存
- Next.js Request → Node.js `IncomingMessage` への変換アダプターを使用
- 最大ファイルサイズ: 500 MB

---

## Next.js バージョン固有の注意点

### Dynamic Route の params は Promise
Next.js 15 以降、dynamic route の `params` は `Promise` になっている。
必ず `await` すること。

```ts
// 正しい書き方
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

### `instrumentationHook` 設定不要
`next.config.ts` に `experimental.instrumentationHook: true` を追加すると TypeScript エラーになる。
Next.js 14 以降はデフォルト有効なので設定不要。

---

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動 (http://localhost:3000)
npm run build      # プロダクションビルド
npm run lint       # ESLint

# Prisma
npx prisma studio          # DB GUI ブラウザ
npx prisma migrate dev     # スキーマ変更後にマイグレーション実行
npx prisma generate        # クライアント再生成
```

---

## 動作確認手順

1. `npm run dev` でサーバー起動
2. `/admin/displays` でディスプレイを作成 → URL をコピー
3. 別タブで `/display/[code]` を開く（スタンバイ画面）
4. `/admin/files` でファイルをアップロード
5. `/admin/groups` でグループを作成 → `/admin/groups/[id]` でファイルを追加・並び替え
6. `/admin/schedules` でスケジュールを作成（即時テスト: 現在時刻+1分, priority=0）
7. 1分後にディスプレイ画面で再生が始まることを確認
8. 割り込みテスト: 別グループを高優先度（例: priority=10）で設定
