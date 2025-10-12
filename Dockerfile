# ----------------------------------------
# ステージ1: ビルドステージ (アプリケーションのビルド)
# ----------------------------------------
# node:20-alpine をベースイメージとして使用
FROM node:20-alpine AS builder

# 作業ディレクトリの設定
WORKDIR /app

# パッケージファイルをコピー (依存関係の特定のため)
COPY package.json package-lock.json ./ 
# もし yarn を使っている場合は ↓ に変更
# COPY package.json yarn.lock ./

# 依存関係をインストール
# npm を使っている場合
RUN npm ci --prefer-offline 
# もし yarn を使っている場合は ↓ に変更
# RUN yarn install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# Next.jsアプリケーションのビルド
RUN npm run build 
# もし yarn を使っている場合は ↓ に変更
# RUN yarn build


# ----------------------------------------
# ステージ2: 実行ステージ (実行専用の軽量イメージ)
# ----------------------------------------
# 再度 node:20-alpine を使用し、ビルドツールを含まない軽量な環境を作成
FROM node:20-alpine AS runner

# 作業ディレクトリの設定
WORKDIR /app

# 本番環境フラグを設定
ENV NODE_ENV production

# Next.jsの実行に必要なファイルのみをビルドステージからコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Cloud Runのデフォルトポートを設定
ENV PORT 8080

# コンテナポートを公開
EXPOSE 8080

# アプリケーションの実行コマンド
# Next.jsサーバーを起動
CMD ["npm", "start"]
# もし yarn を使っている場合は ↓ に変更
# CMD ["yarn", "start"]