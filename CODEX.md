# Portfolio Monorepo Codex Harness

이 문서는 새 포트폴리오 웹사이트 프로젝트에서 Codex가 따라야 할 작업 기준이다.

목표는 단순 정적 포트폴리오가 아니라, **프론트엔드와 백엔드가 한 저장소 안에서 같이 돌아가는 풀스택 포트폴리오**를 만드는 것이다. 백엔드는 DAMARA BE에서 사용했던 구조처럼 TypeScript 기반 Express API로 구성하고, 프론트엔드는 실제 서비스처럼 관리 가능한 React/Vite 기반 앱으로 구성한다.

## 1. 프로젝트 방향

### 핵심 목표

- 포트폴리오 웹사이트를 실제 서비스 수준으로 구성한다.
- FE와 BE를 한 레포에서 함께 관리한다.
- 백엔드는 DAMARA BE처럼 계층을 분리한다.
- API 문서는 Swagger/OpenAPI로 관리한다.
- CI/CD는 GitHub Actions 기준으로 빌드, 테스트, 배포까지 고려한다.
- 배포 후에도 운영 가능한 구조를 만든다.

### 서비스 성격

이 프로젝트는 최원빈의 포트폴리오 사이트이면서 동시에 백엔드 역량을 보여주는 데모 서비스다.

프론트엔드는 방문자가 보는 포트폴리오 화면을 담당한다.

백엔드는 다음 기능을 담당한다.

- 프로젝트 목록 API
- 기술 스택 API
- 이력/경험 API
- 문의 폼 API
- 관리자용 콘텐츠 관리 API
- Swagger API 문서
- 운영 로그와 헬스체크

## 2. 권장 디렉토리 구조

```text
portfolio/
  apps/
    web/
      src/
      public/
      package.json
      vite.config.ts
    api/
      src/
        common/
        config/
        controllers/
        db/
        models/
        repos/
        routes/
        services/
        types/
        app.ts
        server.ts
      tests/
      package.json
      tsconfig.json
  packages/
    shared/
      src/
        api-types/
        constants/
        schemas/
      package.json
  docs/
    api/
      SWAGGER_CHANGELOG.md
    architecture/
      ERD.md
      ERD_CHANGELOG.md
    features/
    deploy/
  .github/
    workflows/
      ci.yml
      deploy-web.yml
      deploy-api.yml
  docker/
  CODEX.md
  README.md
  package.json
```

처음부터 모든 폴더를 만들 필요는 없다. 기능이 생길 때 위 구조에 맞춰 확장한다.

## 3. 기술 스택 기준

### Frontend

기본 선택:

```text
React
Vite
TypeScript
Tailwind CSS
TanStack Query
React Router
```

포트폴리오 화면은 정적 소개 페이지처럼 보이더라도 내부 구조는 실제 앱처럼 관리한다.

권장 화면:

- 홈
- 소개
- 프로젝트 상세
- 기술 스택
- 경력/경험
- 블로그 또는 개발 기록
- 연락하기
- 관리자 로그인
- 관리자 프로젝트 관리

### Backend

DAMARA BE와 비슷한 구조로 구성한다.

```text
Node.js
TypeScript
Express
Sequelize
MySQL 또는 PostgreSQL
Zod
Swagger/OpenAPI
Vitest
Supertest
PM2 또는 Docker
```

백엔드는 다음 계층을 지킨다.

```text
routes
  HTTP path와 Swagger 주석 담당

controllers
  req/res 처리, Zod 검증, status code 결정

services
  비즈니스 로직 담당

repos
  DB 접근 담당

models
  Sequelize 모델과 관계 정의

common
  에러, 응답, 상수, 유틸
```

controller에서 직접 DB 모델을 호출하지 않는다.

service에서 Express `req`, `res`에 의존하지 않는다.

repo는 HTTP 개념을 알지 않는다.

## 4. Backend 설계 원칙

### API 기본 구조

```text
GET    /api/health
GET    /api/projects
GET    /api/projects/:id
POST   /api/contact
GET    /api/skills
GET    /api/experiences
GET    /api/posts
GET    /api/posts/:slug
POST   /api/admin/login
POST   /api/admin/projects
PATCH  /api/admin/projects/:id
DELETE /api/admin/projects/:id
```

초기에는 프로젝트/스킬/경험 데이터를 seed 또는 JSON으로 시작해도 된다. 다만 API 구조는 DB로 옮기기 쉬운 형태로 만든다.

### 응답 형식

성공 응답은 가능하면 일관되게 만든다.

```json
{
  "data": {},
  "meta": {}
}
```

목록 응답은 페이지네이션을 고려한다.

```json
{
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0,
  "hasNext": false
}
```

에러 응답도 통일한다.

```json
{
  "error": "PROJECT_NOT_FOUND",
  "message": "프로젝트를 찾을 수 없습니다.",
  "details": {}
}
```

### 검증

요청 바디, query, params는 Zod로 검증한다.

검증 schema는 다음 위치에 둔다.

```text
apps/api/src/routes/common/validation/
```

### 에러 처리

전역 에러 핸들러를 둔다.

서비스 로직에서는 `RouteError` 또는 프로젝트 전용 에러 클래스를 던진다.

예:

```text
PROJECT_NOT_FOUND
INVALID_CONTACT_EMAIL
ADMIN_UNAUTHORIZED
FILE_TOO_LARGE
```

### Swagger/OpenAPI

API가 추가되거나 요청/응답 계약이 바뀌면 반드시 Swagger를 업데이트한다.

문서 위치:

```text
apps/api/src/config/swagger.ts
docs/api/SWAGGER_CHANGELOG.md
docs/openapi/openapi.json
```

프론트엔드가 API 계약을 추적할 수 있어야 한다.

## 5. Frontend 설계 원칙

### 포트폴리오 톤

개발자 포트폴리오지만 너무 템플릿처럼 보이지 않게 만든다.

핵심은 다음이다.

- 프로젝트가 먼저 보일 것
- 기술 선택 이유가 드러날 것
- 백엔드 역량이 숨지 않을 것
- API 문서, ERD, 배포 구조까지 포트폴리오 자산으로 보여줄 것

### 화면 구성

홈 첫 화면에는 자기소개보다 프로젝트 임팩트가 먼저 와도 좋다.

권장 섹션:

```text
Hero
  이름, 포지션, 핵심 문장

Featured Projects
  DAMARA
  주요 프로젝트 2~3개

Backend Case Study
  API 설계
  ERD
  Swagger
  배포 구조

Skills
  언어, 프레임워크, DB, DevOps

Experience
  활동, 수상, 팀 프로젝트

Contact
  이메일, GitHub, LinkedIn, 문의 폼
```

### API 연동

프론트엔드는 `.env`로 API base URL을 받는다.

```text
VITE_API_BASE_URL=http://localhost:3001/api
```

API 호출은 한 곳에서 관리한다.

```text
apps/web/src/lib/api.ts
```

React Query를 사용하면 query key를 명확히 관리한다.

```ts
["projects"]
["projects", projectId]
["skills"]
["experiences"]
```

## 6. 공통 타입과 스키마

FE와 BE가 같은 타입을 공유해야 하면 `packages/shared`를 사용한다.

예:

```text
ProjectSummary
ProjectDetail
Skill
Experience
ContactRequest
ContactResponse
```

단, shared 패키지가 과해지면 초반에는 OpenAPI 타입 생성으로 대체해도 된다.

## 7. DB/ERD 규칙

DB 구조 변경이 생기면 문서에 남긴다.

```text
docs/architecture/ERD.md
docs/architecture/ERD_CHANGELOG.md
```

기본 테이블 후보:

```text
admins
projects
project_images
project_links
skills
project_skills
experiences
posts
contacts
site_settings
audit_logs
```

관리자 기능이 들어가면 운영 로그를 남긴다.

예:

```text
누가 프로젝트를 수정했는지
언제 공개 여부를 바꿨는지
어떤 문의를 처리했는지
```

## 8. CI/CD 기준

GitHub Actions를 기준으로 작성한다.

### CI

PR마다 다음을 실행한다.

```text
npm ci
npm run lint
npm run type-check
npm run test
npm run build
```

모노레포라면 루트 스크립트에서 FE/BE를 동시에 실행한다.

예:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:api\"",
    "dev:web": "npm --workspace apps/web run dev",
    "dev:api": "npm --workspace apps/api run dev",
    "build": "npm run build:web && npm run build:api",
    "build:web": "npm --workspace apps/web run build",
    "build:api": "npm --workspace apps/api run build",
    "test": "npm run test:web && npm run test:api",
    "lint": "npm run lint:web && npm run lint:api",
    "type-check": "npm run type-check:web && npm run type-check:api"
  }
}
```

### Web 배포

선택지:

```text
Vercel
Cloudflare Pages
S3 + CloudFront
Nginx static hosting
```

초기 추천:

```text
Frontend: Vercel
Backend: EC2 + Nginx + PM2 또는 Docker
DB: RDS 또는 EC2 MySQL/PostgreSQL
```

### API 배포

EC2 기준:

```text
git pull
npm ci --omit=dev 또는 npm install --legacy-peer-deps
npm run build
pm2 start dist/src/server.js --name portfolio-api --update-env
pm2 save
sudo systemctl reload nginx
```

Docker 기준:

```text
docker build -t portfolio-api .
docker compose up -d
```

### 운영 도메인 예시

```text
Frontend: https://wonbin.dev
Backend: https://api.wonbin.dev
Swagger: https://api.wonbin.dev/api-docs
```

## 9. GitHub Actions 예시

초기 CI 파일은 다음 형태로 만든다.

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build
```

배포 워크플로우는 프로젝트 호스팅 방식이 확정된 뒤 작성한다.

## 10. 환경 변수 기준

루트에는 `.env.example`을 둔다.

FE:

```text
VITE_API_BASE_URL=http://localhost:3001/api
```

BE:

```text
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=portfolio
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
CORS_ORIGIN=http://localhost:5173
API_BASE_URL=http://localhost:3001
```

실제 `.env`는 커밋하지 않는다.

## 11. 문서화 규칙

기능 개발마다 문서를 남긴다.

```text
docs/features/
```

기능 문서에는 최소한 다음을 포함한다.

1. 작업 시점
2. 문제 배경
3. 기획 방향
4. 변경 전/후 비교
5. 코드 변경 요약
6. API 영향
7. DB 영향
8. FE 영향
9. 검증 방법
10. 남은 작업

API 변경은 여기에 남긴다.

```text
docs/api/SWAGGER_CHANGELOG.md
```

DB 변경은 여기에 남긴다.

```text
docs/architecture/ERD_CHANGELOG.md
```

## 12. 커밋 규칙

커밋과 푸시는 사용자가 명시적으로 허용했을 때만 실행한다.

구현, 문서 수정, 빌드 확인 지시는 커밋/푸시 허용으로 해석하지 않는다.

커밋 전에는 어떤 파일을 어떤 단위로 커밋할지 먼저 공유한다.

커밋은 기능 단위로 쪼갠다.

서로 다른 성격의 변경은 한 커밋에 섞지 않는다.

예:

```text
<Feat> 프로젝트 API 모델 추가
<Feat> 프로젝트 목록 화면 구현
<Feat> Swagger 프로젝트 API 문서화
<Chore> CI 워크플로우 추가
```

커밋 전에는 가능하면 빌드 또는 테스트를 실행한다.

```text
npm run build
npm run test
```

실행하지 못했으면 최종 답변에 이유를 남긴다.

## 13. PR 메시지 규칙

사용자가 PR 메시지를 요청하면 제목과 본문을 함께 제공한다.

형식:

```text
# PR 제목

<Feat> 한국말 제목

# PR 본문

## 배경

## 변경 내용

## API 영향

## DB 영향

## FE 영향

## 문서

## 검증
```

## 14. Codex 작업 흐름

기능 개발 시 다음 순서를 지킨다.

1. 현재 구현을 먼저 읽는다.
2. FE/BE 중 어느 영역인지 구분한다.
3. API 계약이 필요한 경우 먼저 계약을 잡는다.
4. BE 변경이 있으면 Swagger와 changelog를 갱신한다.
5. DB 변경이 있으면 ERD 문서를 갱신한다.
6. FE 변경은 실제 화면 흐름까지 연결한다.
7. 가능한 범위에서 테스트와 빌드를 실행한다.
8. 변경 파일과 검증 결과를 요약한다.
9. 커밋은 사용자 허용 후 진행한다.

## 15. 기능 우선순위

초기 MVP:

```text
1. 포트폴리오 홈 화면
2. 프로젝트 목록/상세
3. 프로젝트 API
4. 기술 스택 API
5. 문의 폼 API
6. Swagger 문서
7. CI
8. 기본 배포
```

2차:

```text
1. 관리자 로그인
2. 프로젝트 CRUD
3. 이미지 업로드
4. 블로그/개발 기록
5. 관리자 대시보드
6. 배포 자동화
7. 이메일 알림
```

3차:

```text
1. 방문자 통계
2. 프로젝트별 조회수
3. 이력서 PDF 다운로드
4. 다국어 지원
5. 검색
6. CMS화
```

## 16. 백엔드 구현 스타일

DAMARA BE처럼 기능별로 다음 파일을 갖춘다.

예: 프로젝트 API

```text
apps/api/src/models/Project.ts
apps/api/src/repos/ProjectRepo.ts
apps/api/src/services/ProjectService.ts
apps/api/src/controllers/project.controller.ts
apps/api/src/routes/projects/ProjectRoutes.ts
apps/api/src/routes/common/validation/project-schemas.ts
```

예: 문의 API

```text
apps/api/src/models/Contact.ts
apps/api/src/repos/ContactRepo.ts
apps/api/src/services/ContactService.ts
apps/api/src/controllers/contact.controller.ts
apps/api/src/routes/contact/ContactRoutes.ts
apps/api/src/routes/common/validation/contact-schemas.ts
```

## 17. 프론트엔드 구현 스타일

페이지와 기능 단위를 분리한다.

```text
apps/web/src/pages/
apps/web/src/features/
apps/web/src/components/
apps/web/src/lib/
apps/web/src/hooks/
apps/web/src/styles/
```

프로젝트 화면 예:

```text
features/projects/
  api.ts
  components/
  hooks.ts
  types.ts
```

버튼, 카드, 배지, 입력폼 같은 공통 UI는 `components/ui`로 모은다.

## 18. 디자인 방향

포트폴리오지만 장식보다 정보 밀도를 우선한다.

좋은 방향:

- 프로젝트 카드에서 역할, 기술, 성과가 바로 보이게 한다.
- 백엔드 프로젝트는 ERD, API 문서, 배포 구조를 같이 보여준다.
- 코드 링크, 배포 링크, Swagger 링크를 명확히 제공한다.
- 모바일에서도 프로젝트 설명이 읽히게 한다.

피해야 할 방향:

- 의미 없는 3D 장식만 많은 랜딩 페이지
- 기술 스택 로고만 나열하는 화면
- 프로젝트 설명이 추상적인 화면
- API/DB/배포 경험이 보이지 않는 포트폴리오

## 19. 운영 체크리스트

배포 전 확인:

```text
npm run build
npm run test
npm run lint
npm run type-check
```

API 확인:

```text
GET /api/health
GET /api-docs
GET /api/projects
```

운영 확인:

```text
pm2 list
pm2 logs portfolio-api --lines 50
nginx -t
curl -I https://api.example.com/api/health
```

## 20. Codex에게 요청할 때 예시

```text
이 프로젝트는 CODEX.md 기준으로 작업해.
apps/api는 DAMARA BE처럼 Express + TypeScript + Sequelize 구조로 잡고,
apps/web은 React + Vite + TypeScript로 만들어.
먼저 프로젝트 목록 API와 프로젝트 목록 화면을 연결해.
Swagger, docs/features 개발 보고서, CI까지 같이 챙겨.
커밋은 아직 하지 마.
```

```text
프로젝트 상세 API를 만들고 FE 상세 페이지까지 연결해.
API 계약 변경은 Swagger와 SWAGGER_CHANGELOG에 남겨.
DB 변경이 있으면 ERD_CHANGELOG도 갱신해.
빌드까지 확인해.
```

```text
GitHub Actions CI를 추가해.
FE/BE lint, type-check, test, build가 모두 돌도록 구성해.
실패 가능한 부분은 문서에 남겨.
```
