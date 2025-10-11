# ビルドステージ
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# 実行ステージ (より軽量)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
# Next.jsの実行に必要なファイルをコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 環境変数 (Cloud Runで設定するため、ここではデフォルト値)
ENV PORT 8080

EXPOSE 8080

CMD ["yarn", "start"]