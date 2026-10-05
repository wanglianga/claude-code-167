# ---------- 阶段一：构建前端 ----------
FROM node:20-alpine AS webbuild
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# vite 构建产物输出到 ../server/public（见 web/vite.config.ts）
RUN npm run build

# ---------- 阶段二：后端运行 + 托管前端 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/data
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund
COPY server/src ./server/src
COPY --from=webbuild /app/server/public ./server/public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "server/src/index.js"]
