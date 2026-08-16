# syntax=docker/dockerfile:1

# ============================================================
# 1. Build stage
#    - 전체 의존성 설치
#    - TypeScript 컴파일
# ============================================================
FROM node:22-bookworm-slim AS build

WORKDIR /app

# bcrypt 같은 native module이 필요할 경우를 대비한 빌드 도구
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# 의존성 파일만 먼저 복사해서 Docker layer cache 활용
COPY package.json package-lock.json ./

# 현재 프로젝트의 peer dependency 충돌을 우회
RUN npm ci --legacy-peer-deps

# 애플리케이션 소스 복사
COPY . .

# TypeScript 컴파일 + public/views 복사
RUN npm run build


# ============================================================
# 2. Production dependencies stage
#    - 실제 실행에 필요한 dependency만 설치
# ============================================================
FROM node:22-bookworm-slim AS prod-deps

WORKDIR /app

# production dependency 중 bcrypt 같은 native module 설치 대비
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --legacy-peer-deps \
    && npm cache clean --force


# ============================================================
# 3. Runtime stage
#    - 실제 Kubernetes에서 실행되는 최종 이미지
# ============================================================
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

# production dependency만 복사
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# build stage에서 생성된 결과물만 복사
COPY --from=build --chown=node:node /app/dist ./dist

# package metadata
COPY --chown=node:node package.json package-lock.json ./

# 사용자 업로드 경로 생성
# .dockerignore에서 기존 업로드 이미지는 제외했으므로
# 컨테이너에서는 쓰기 가능한 빈 디렉터리만 준비
RUN mkdir -p /app/dist/src/public/uploads/images \
    && chown -R node:node /app/dist/src/public/uploads

# root가 아닌 Node 공식 이미지의 node 사용자로 실행
USER node

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
