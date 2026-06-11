# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# package.json만 먼저 복사해서 레이어 캐시 활용
COPY package*.json ./
RUN npm ci

# 소스 전체 복사 후 TypeScript 빌드
COPY . .
RUN npm run build

# production 의존성만 재설치 (devDependencies 제외)
RUN npm ci --only=production

# ─── Stage 2: Production ─────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# 빌드 결과물과 production node_modules만 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 보안: root 대신 전용 유저로 실행
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
