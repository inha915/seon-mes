# 세온산업 MES/ERP (seon-mes)

[English](README.en.md) | **한국어**

> 가상의 자동차 부품 제조사 **세온산업(Seon Industrial)** 의 수주부터 원자재 입고·생산·결재·출하·LOT 추적까지 다루는 개인 풀스택 포트폴리오입니다.
> 거래처·품목·설비·작업지시·생산실적·사용자는 모두 **가상 데이터**입니다.

**🔗 라이브 데모: https://whimsical-lamington-99ca15.netlify.app**
(Netlify + Netlify Functions + Neon PostgreSQL · 누구나 데이터를 입력할 수 있는 공개 데모라 내용이 바뀌거나 초기화될 수 있습니다 · 첫 요청은 DB 깨우기로 몇 초 걸릴 수 있습니다)

## 1. 프로젝트 소개

세온산업은 냉연·열연 강판을 공급받아 `강판 절단 → 프레스 성형 → 검사` 공정으로 서스펜션·범퍼 브라켓을 만드는 가상의 2차 협력사입니다.
이 시스템은 **수주 → 원자재 입고(내부 LOT 발급) → 수주 연계 작업지시 → LOT별 실제 사용량으로 생산실적 입력 → 팀장 결재 승인 시 확정(원자재 차감·완제품 LOT 입고) → 출하 → 원자재 입고부터 고객 출하까지 LOT 추적**을 하나의 흐름으로 처리합니다.
재고를 바꾸는 작업(실적 확정·결재 승인·출하)은 **하나의 DB 트랜잭션**으로 묶고, 중복 확정·같은 LOT 동시 차감·동시 출하는 DB 제약과 조건부 UPDATE·행 잠금으로 막습니다.
화면은 국내 제조업 ERP처럼 **좌측 트리 메뉴(기준정보·영업·생산·재고·결재·설비·시스템)** 로 구성했고 한국어·영어를 지원합니다.

## 2. 주요 화면

아래 화면은 모두 로컬에서 실제로 실행한 뒤 E2E 스크립트(`npm run screenshots`)로 캡처했습니다.

| 대시보드 — 생산·영업·결재·설비 현황 | 생산실적 — 계획·양품·불량·LOT 현재고를 한 화면에서 입력 |
|---|---|
| ![대시보드](docs/images/00-dashboard.png) | ![생산실적](docs/images/04-production.png) |
| **재고 부족** — 부족 LOT·수량 표시, 진행 차단 | **결재함** — 팀장 승인 시 확정 트랜잭션 실행 |
| ![재고 부족](docs/images/04-production-shortage.png) | ![결재함](docs/images/05-approval-inbox.png) |
| **출하 관리** — 완제품 LOT별 출하(선입선출 배분) | **LOT 추적** — 원자재 입고 ← 생산 ← 완제품 → 고객 출하 |
| ![출하](docs/images/07-shipments-form.png) | ![LOT 추적](docs/images/08-lot-trace.png) |
| **자재 입고** — 입고 등록 즉시 내부 LOT 발급 | **재고현황** — 강판 잔량 80장 · 브라켓 18개 |
| ![자재 입고](docs/images/01-receipts.png) | ![재고현황](docs/images/06-inventory.png) |

그 밖의 캡처: [수주 관리](docs/images/02-sales-orders.png) · [작업지시](docs/images/03-work-orders.png) · [결재 승인 후](docs/images/05-approval-approved.png) · [수불 이력](docs/images/06-inventory-ledger.png) · [설비 관리](docs/images/09-equipment.png) · [공통코드](docs/images/10-codes.png) · [생산실적(English)](docs/images/04-production-en.png) · [LOT 추적(English)](docs/images/08-lot-trace-en.png)

## 3. 메뉴 구성

| 대분류 | 모듈 | 주요 기능 |
|---|---|---|
| 대시보드 | — | 미완료 작업지시, 금일 양품·불량, 결재 대기, 미출하 수주, 설비 가동 현황, 최근 입고 (실제 DB 집계) |
| 기준정보 | 거래처 관리 | 공급사·고객사 등록·조회 (입고는 공급사만, 수주는 고객사만 선택 가능) |
| | 품목·BOM | 원자재·완제품 등록, 완제품 1개당 원자재 기준 소요량 |
| 영업 | 수주 관리 | 수주 등록, 수주 상세(연결 작업지시·출하 가능 LOT·출하 이력), 수주에서 작업지시 생성 |
| | 출하 관리 | 완제품 LOT별 출하 수량 입력, 수주 잔량 초과 방지, 출하 이력 |
| 생산 | 작업지시 | 수주 연계·설비 지정(고장·정비 설비 제외), BOM 기준 예상 소요량 |
| | 생산실적 | 양품·불량, 원자재 LOT별 실제 사용량, 확정 전 확인, 결재 요청 |
| 재고 | 자재 입고 | 거래처·입고일·원자재·수량 입력, 내부 LOT 발급 |
| | 재고현황 | 품목별·LOT별 현재고, 수불 이력(입고·투입·생산입고·출하), 품번·LOT·기간 검색 |
| | LOT 추적 | 완제품 → 작업지시·실적 → 투입 LOT → 최초 입고 역추적, 완제품 → 고객 출하 정추적 |
| 결재 | 결재함 | 생산실적 결재 승인·반려·요청 취소, 결재선(요청·승인) 표시 |
| 설비 | 설비 관리 | 설비 등록, 상태 변경(가동·대기·정비·고장), 점검·수리 이력, 지정 작업지시 |
| 시스템 | 사용자 관리 | 사용자·권한(작업자·팀장·관리자) — 로그인 없이 헤더에서 전환하는 데모용 |
| | 시스템 설정 | 생산실적 결재 사용 여부 (관리자만 변경) |
| | 공통코드 | DB 고정 코드와 언어별 표시명 조회 |

## 4. 데모 시나리오

시드 직후에는 기본 데모용 원자재 **MAT-SPCC12 냉연강판의 재고가 0**이고, 접수 상태의 수주 **SO-SEED-0002 (대양오토, 프런트 브라켓 18개)** 가 있습니다.
헤더의 사용자는 처음에 **김민준(작업자)** 으로 선택됩니다.

| # | 메뉴 | 입력 / 동작 | 확인할 결과 |
|---|---|---|---|
| 1 | 재고 › **자재 입고** | 공급사 `SUP-001 대성철강(가상)`, 원자재 `MAT-SPCC12`, 수량 `100` | 내부 LOT `RM-YYYYMMDD-001` 발급, 입고 이력·재고 즉시 반영 |
| 2 | 영업 › **수주 관리** → SO-SEED-0002 상세 → **작업지시 생성** | 품목·수량이 수주에서 채워짐 → 계획 수량 `20`, 설비 `PR-01` | BOM(1개당 1장) 기준 예상 소요량 **20장**, 수주 상태 `접수 → 생산중`. 정비 중인 `PR-02`는 선택 불가 |
| 3 | 생산 › **생산실적** | 작업지시 선택 → 양품 `18`, 불량 `2`, 강판 LOT 사용량 `20` (`150`을 넣으면 부족 LOT·수량 표시와 진행 차단) → **결재 요청** | 결재번호 `AP-YYYYMMDD-001` 발급. **아직 재고는 바뀌지 않음** |
| 4 | 결재 › **결재함** | 작업자로는 승인 버튼이 없음 → 헤더에서 **이서연(팀장)** 으로 전환 → 승인 | 승인과 동시에 실적 확정·강판 차감·완제품 LOT `FG-YYYYMMDD-001`(18개) 발급 |
| 5 | 재고 › **재고현황** | 품목별 현재고 / 수불 이력 | 강판 **80장**, 브라켓 **18개** |
| 6 | 영업 › **출하 관리** | 수주 SO-SEED-0002 → `잔량 선입선출 배분` → 출하 등록 | 완제품 LOT 18개 차감, 수주 상태 `출하완료`, 수불 `출하 −18` |
| 7 | 재고 › **LOT 추적** | 완제품 LOT 조회 | 완제품 ← 작업지시·실적 ← 강판 LOT(20장) ← 최초 입고(대성철강 100장), 출하 내역 → **대양오토** |

바로 조회해 볼 수 있는 **시드 완료 사례**도 있습니다: `FG-SEED-0001` (한결모터스 수주 `SO-SEED-0001` → `WO-SEED-0001` → 결재 `AP-SEED-0001` 승인 → 38개 생산 → 20개 출하 `SH-SEED-0001`).
기본 데모와 품목·LOT가 분리되어 있어 데모 수치(80장/18개)에 영향을 주지 않습니다. 결재 없이 바로 확정하려면 관리자(박지훈)로 전환해 시스템 › 시스템 설정에서 **생산실적 결재 사용**을 끄면 됩니다.

## 5. 기술 스택과 폴더 구조

| 영역 | 기술 | 역할 |
|---|---|---|
| 프론트엔드 | React 19, TypeScript, Vite 7 | 데스크톱 업무 화면, 화면 단위 코드 분할 |
| 라우팅 / 서버 상태 | TanStack Router, TanStack Query | 메뉴 구조와 같은 경로, 조회 캐시와 저장 후 재조회 |
| UI / 폼 | Tailwind CSS 4, shadcn/ui(Radix), React Hook Form, Zod | 디자인 토큰 + ERP 공통 컴포넌트, 입력 검증 |
| 다국어 | i18next, react-i18next, `Intl` | ko/en 번역, 날짜·숫자 로캘 포맷 |
| 백엔드 | Node.js, Express 5, TypeScript, Zod | REST API, 요청값 검증, 업무 규칙(서비스 계층) |
| 데이터베이스 | PostgreSQL 16, Prisma 6 | 트랜잭션, UNIQUE·부분 UNIQUE·CHECK 제약, 마이그레이션·시드 |
| 개발 환경 | npm workspaces, Docker Compose, Vitest, Playwright | 루트에서 설치·실행·빌드·테스트, E2E·캡처 |

```text
seon-mes/
├─ backend/
│  ├─ prisma/  schema.prisma · migrations/ (CHECK·부분 UNIQUE 포함) · seed.ts (재실행해도 중복 없음)
│  ├─ src/
│  │  ├─ app.ts · routes.ts          # Express 앱, 대분류 순서의 라우트 등록, 오류 응답 형식
│  │  ├─ lib/                        # 오류 코드, Zod 검증, 채번, 재고 조건부 차감(stock.ts), 현재 사용자
│  │  └─ modules/<대분류>/<모듈>/      # *.routes.ts(HTTP) + *.service.ts(업무 규칙)
│  │     master/{partners,items} · sales/{orders,shipments} · production/{work-orders,results}
│  │     inventory/{receipts,stock,lots} · approval · equipment · system/{users,settings} · dashboard
│  └─ tests/                         # 통합 테스트 (실제 PostgreSQL 테스트 DB)
├─ frontend/src/
│  ├─ app/          router.tsx · menu.ts(메뉴 트리 정의) · layout/(좌측 트리, 헤더, 사용자·언어 전환)
│  ├─ modules/<대분류>/<모듈>/        # 화면 + api.ts(TanStack Query 훅) · <대분류>/types.ts
│  ├─ shared/
│  │  ├─ ui/          shadcn/ui 기본 컴포넌트
│  │  ├─ components/  Screen·SplitLayout, Panel, SearchPanel, DataGrid, FormField·FormGrid,
│  │  │               DescriptionList·StatBox, CodeBadge·LotLink·ItemCell, KpiCard, ShortagePanel, 상태 표시
│  │  ├─ codes.ts     공통코드 레지스트리 (코드 그룹 → 값 → 배지 색)
│  │  ├─ lib/         API 클라이언트, 오류 코드 → 번역, Intl 포맷, Query 키, 폼 스키마
│  │  └─ hooks/       현재 사용자
│  ├─ styles/       theme.css(디자인 토큰) · components.css(ERP 공통 클래스) · index.css
│  └─ i18n/locales/{ko,en}.json
├─ netlify/  functions/api.ts (Express → Netlify Function) · plugins/slim-function-deps (함수 크기 최적화) · netlify.toml
├─ scripts/  e2e-demo.mjs (브라우저 E2E + 캡처)
└─ docker-compose.yml                         # 개발용 PostgreSQL (호스트 포트 5433)
```

### 프론트 공통 UI 구조

- **디자인 토큰**: 색·반경·폰트를 [`styles/theme.css`](frontend/src/styles/theme.css) 의 CSS 변수로만 정의하고, Tailwind 테마와 shadcn/ui가 이를 참조합니다.
- **ERP 공통 클래스**: 패널 머리글, 조회조건 영역, 그리드 헤더·선택 행, 코드값·수치 셀을 [`styles/components.css`](frontend/src/styles/components.css) 에서 한 번 정의합니다.
- **공통 컴포넌트**: 모든 목록 화면은 `SearchPanel`(조회조건, 조회 버튼을 눌러야 적용) + `DataGrid`(컬럼 정의만 넘기면 헤더 고정·로딩·오류·결과 없음·선택 행·페이지네이션 처리) 조합을 씁니다. 상태 배지는 `CodeBadge` 하나로 모든 코드 그룹을 표시합니다.
- **메뉴 = 경로 = 폴더**: [`app/menu.ts`](frontend/src/app/menu.ts) 의 대분류/모듈이 URL(`/sales/orders`)과 폴더(`modules/sales/orders`)에 그대로 대응합니다.

## 6. 로컬 실행 방법

### 사전 설치

- **Node.js 20.19 이상** (개발·검증: Node.js 24.14.1, npm 11.11.0) — `.nvmrc` 는 22
- **Docker Desktop** (Docker Compose v2)
- Git

### Windows PowerShell 기준 실행 순서

```powershell
# 0) 소스 받기
git clone https://github.com/inha915/seon-mes.git
cd seon-mes

# 1) 의존성 설치 (루트에서 frontend/backend 모두 설치, Prisma Client 생성)
npm install

# 2) 환경변수 설정 — backend/.env 는 Git 에서 제외됩니다
Copy-Item .env.example backend\.env

# 3) DB 실행 — seon-mes 전용 PostgreSQL 컨테이너 (호스트 포트 5433)
npm run db:up

# 4) 마이그레이션 적용
npm run db:migrate

# 5) 시드 실행 (다시 실행해도 데모 데이터가 중복 생성되지 않습니다)
npm run db:seed

# 6) 개발 서버 실행 (API + 웹 동시 실행)
npm run dev
```

| 구분 | 주소 |
|---|---|
| 웹 화면 | http://localhost:5173 |
| API | http://localhost:4000/api (상태 확인: http://localhost:4000/api/health) |
| PostgreSQL | `localhost:5433` / DB `seon_mes` / 사용자 `seon` |

> macOS·Linux 에서는 2단계를 `cp .env.example backend/.env` 로 실행하면 됩니다. 나머지 명령은 같습니다.
> 이전 버전으로 이미 시드한 DB라면 `npm run db:migrate` → `npm run db:seed` 만 다시 실행하면 사용자·고객사·설비·수주 데이터가 추가됩니다. 데모 수치를 처음부터 보려면 `npm run db:reset` 을 실행하세요.

### 환경변수 (`backend/.env`)

| 이름 | 예시 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql://seon:seon_dev_pw@localhost:5433/seon_mes?schema=public` | 개발 DB |
| `TEST_DATABASE_URL` | `postgresql://seon:seon_dev_pw@localhost:5433/seon_mes_test?schema=public` | 통합 테스트 전용 DB (컨테이너 최초 기동 시 자동 생성) |
| `PORT` | `4000` | API 포트 |
| `CORS_ORIGIN` | `http://localhost:5173` | 허용할 프론트 주소 |
| `APP_TIMEZONE` | `Asia/Seoul` (기본값) | "금일" 집계·기간 검색의 기준 시간대 |

### 그 밖의 명령 (루트에서 실행)

| 명령 | 설명 |
|---|---|
| `npm run typecheck` | 백엔드·프론트 타입 검사 |
| `npm run build` | 백엔드(`backend/dist`)·프론트(`frontend/dist`) 빌드 |
| `npm test` | 백엔드 통합 테스트 + 프론트 번역 리소스 테스트 |
| `npm run i18n:check` | 번역 키 누락·변수 불일치·코드 매핑 검사 |
| `npm run db:reset` | DB 초기화 후 마이그레이션·시드 재실행 (**데이터 삭제**) |
| `npm run db:migrate:neon` / `npm run db:seed:neon` | `backend/.env.neon`(Git 제외)의 Neon 주소로 마이그레이션·시드 적용. 예시: [backend/.env.neon.example](backend/.env.neon.example) |
| `npm run e2e` | 브라우저 E2E 시연 검증 (시드 직후 DB + `npm run dev` 실행 중이어야 함) |
| `npm run screenshots` | E2E 검증 + `docs/images/*.png` 재캡처 |
| `npm run db:down` | DB 컨테이너 중지 (데이터 볼륨은 유지) |

> **참고(Windows 보안 정책)**: Windows 의 애플리케이션 제어(Smart App Control 등)가 Rollup 의 네이티브 `.node` 바이너리를 차단하는 환경이 있어,
> 루트 `package.json` 에서 `rollup` 을 공식 WASM 빌드(`@rollup/wasm-node`)로 대체했습니다. 기능은 같고 빌드가 약간 느릴 수 있습니다.
> E2E 스크립트는 Windows 기본 브라우저인 Microsoft Edge 를 사용합니다 (`PW_CHANNEL=chrome` 등으로 변경 가능).

## 7. 데이터 관계

```mermaid
erDiagram
    PARTNER ||--o{ RECEIPT : "공급사"
    PARTNER ||--o{ SALES_ORDER : "고객사"
    ITEM ||--o{ BOM_LINE : "완제품 / 원자재"
    ITEM ||--o{ LOT : "품목"
    SALES_ORDER ||--o{ WORK_ORDER : "수주 연계"
    EQUIPMENT ||--o{ WORK_ORDER : "설비 지정"
    EQUIPMENT ||--o{ EQUIPMENT_LOG : "상태·점검·수리"
    RECEIPT ||--|| LOT : "입고 1건 = 원자재 LOT 1개"
    WORK_ORDER ||--o{ APPROVAL_REQUEST : "결재 (대기는 1건만)"
    WORK_ORDER ||--o| PRODUCTION_RESULT : "work_order_id UNIQUE"
    APPROVAL_REQUEST |o--o| PRODUCTION_RESULT : "승인 시 생성"
    PRODUCTION_RESULT ||--|{ MATERIAL_CONSUMPTION : "LOT별 실제 사용량"
    LOT ||--o{ MATERIAL_CONSUMPTION : "투입 원자재 LOT"
    PRODUCTION_RESULT |o--o| LOT : "완제품 LOT (양품 > 0)"
    SALES_ORDER ||--o{ SHIPMENT : "출하"
    SHIPMENT ||--|{ SHIPMENT_LINE : "LOT별 출하"
    LOT ||--o{ SHIPMENT_LINE : "출하 완제품 LOT"
    LOT ||--o{ INVENTORY_TRANSACTION : "수불"
    USER ||--o{ APPROVAL_REQUEST : "요청자 / 승인자"

    LOT {
        string lot_no UK "RM-/FG-YYYYMMDD-NNN"
        decimal qty "현재고, CHECK >= 0"
    }
    WORK_ORDER {
        string work_order_no UK
        int planned_qty
        enum status "PLANNED | COMPLETED"
    }
    APPROVAL_REQUEST {
        string request_no UK
        json payload "실적 입력값"
        enum status "PENDING | APPROVED | REJECTED | CANCELLED"
    }
    SALES_ORDER {
        string order_no UK
        int qty
        enum status "OPEN | IN_PRODUCTION | PARTIALLY_SHIPPED | SHIPPED"
    }
    INVENTORY_TRANSACTION {
        enum type "입고 | 생산투입 | 생산입고 | 출하"
        decimal qty "부호 있는 변동량"
        decimal balance_after "처리 후 LOT 잔량"
    }
    EQUIPMENT {
        string code UK
        enum status "RUNNING | IDLE | MAINTENANCE | BREAKDOWN"
    }
```

- **BOM** 은 작업지시의 **계획 소요량** 계산에만 쓰고, 재고는 생산실적에 입력한 **LOT별 실제 사용량**으로 차감합니다.
- 재고의 기준은 `LOT.qty`(현재고)이고, `INVENTORY_TRANSACTION` 은 모든 증감을 처리 후 잔량과 함께 남기는 수불 원장입니다.
- 문서 번호(LOT·입고·수주·출하·작업지시·실적·결재)는 `document_sequences` 를 `INSERT … ON CONFLICT DO UPDATE … RETURNING` 으로 원자적으로 채번합니다.

## 8. 주요 설계와 검증

### 8.1 생산실적 확정과 결재 트랜잭션

[`production.service.ts`](backend/src/modules/production/results/production.service.ts) 는 확정 로직을 두 단계로 나눕니다.

1. [`precheckProduction`](backend/src/modules/production/results/production.service.ts#L46) — 작업지시 상태, 투입 LOT(존재·원자재·**해당 완제품 BOM 구성품**), **재고 부족**(부족 LOT를 모두 모아 `INSUFFICIENT_STOCK` + `{ lotNo, requestedQty, availableQty, shortageQty }[]`) 검사. 데이터는 바꾸지 않습니다.
2. [`confirmProductionTx`](backend/src/modules/production/results/production.service.ts#L90) — 호출한 쪽 트랜잭션 안에서 실행: 작업지시 선점(`WHERE status='PLANNED'`) → 실적 저장(`work_order_id UNIQUE`) → LOT id 순서로 조건부 차감 + 사용 이력 + 수불 → 양품 > 0 이면 완제품 LOT 발급. **양품 0 이면 LOT 미발급**, 실적·사용 이력만 남김.

결재를 켜면(기본값) 흐름은 다음과 같습니다.

- **결재 요청** ([`requestApproval`](backend/src/modules/approval/approval.service.ts#L126)): 같은 `precheck` 를 통과해야 결재함에 올라갑니다. 재고는 바뀌지 않습니다.
- **승인** ([`approveRequest`](backend/src/modules/approval/approval.service.ts#L172)): 팀장·관리자만 가능. `결재 상태 PENDING → APPROVED` 와 `confirmProductionTx` 를 **하나의 트랜잭션**으로 실행합니다. 승인 시점에 다른 작업이 먼저 재고를 써서 부족하면 전체가 롤백되어 **결재는 대기로 남고** 실적·수불은 생기지 않습니다.
- 결재를 끄면 `POST /api/production-results` 가 같은 `confirmProductionTx` 로 바로 확정합니다. 켜져 있을 때 직접 확정은 `APPROVAL_REQUIRED` 로 막습니다.

### 8.2 중복·동시성 처리

| 위험 | 방어 | 근거 |
|---|---|---|
| 같은 작업지시를 두 번(동시에) 확정 | ① `status='PLANNED'` 조건부 UPDATE 로 선점 ② `production_results.work_order_id` **UNIQUE** — 경합 시 P2002 를 `WORK_ORDER_ALREADY_CONFIRMED` 로 변환 | [production.service.ts#L95](backend/src/modules/production/results/production.service.ts#L95), [init migration.sql#L173](backend/prisma/migrations/20261112045143_init/migration.sql#L173) |
| 같은 작업지시에 결재를 동시에 여러 번 요청 | 작업지시당 `PENDING` 1건만 허용하는 **부분 UNIQUE 인덱스** (`WHERE status='PENDING'`) | [erp_modules migration.sql#L240](backend/prisma/migrations/20261112075222_erp_modules/migration.sql#L240) |
| 서로 다른 작업이 같은 LOT 를 동시에 차감 (생산 투입·출하 공통) | [`decrementLot`](backend/src/lib/stock.ts#L41): `UPDATE lots SET qty = qty - $n WHERE id = $id AND qty >= $n RETURNING qty` — READ COMMITTED 에서 뒤 트랜잭션은 앞 트랜잭션 종료 후 **최신 값으로 조건을 재평가**. 0행이면 재고 부족으로 롤백 | [stock.ts#L41](backend/src/lib/stock.ts#L41) |
| 같은 수주에 동시 출하로 수주 수량 초과 | 출하 트랜잭션 시작 시 **수주 행 잠금** `SELECT … FOR UPDATE` 후 잔량 확인 | [shipments.service.ts#L101](backend/src/modules/sales/shipments/shipments.service.ts#L101) |
| 위 로직을 우회한 음수 재고 | `CHECK (qty >= 0)` 제약이 최종 안전장치 | [init migration.sql#L242](backend/prisma/migrations/20261112045143_init/migration.sql#L242) |
| 여러 LOT 를 쓰는 작업끼리 교착 상태 | LOT id 오름차순으로 차감 (잠금 순서 고정) | 같은 파일들 |

**검증 결과 (2026-11-12 로컬 실행)**

- 백엔드 통합 테스트 **27건 통과** — 실제 PostgreSQL 테스트 DB ([production.test.ts](backend/tests/production.test.ts) · [erp.test.ts](backend/tests/erp.test.ts) · [api.test.ts](backend/tests/api.test.ts))
  - 기본 데모, 양품 0, 재고 부족 시 부분 저장 없음, DB 제약 우회 시도(UNIQUE·CHECK)
  - **같은 작업지시 동시 확정 5건 → 1건만 성공**, **100장 LOT 에 30장씩 6건 동시 → 3건 성공·잔량 10**
  - 결재: 작업자 승인 시도 → `FORBIDDEN_ROLE`, **동시 결재 요청 3건 → 1건만 생성**, **승인 시점 재고 부족 → 결재 대기 유지·실적 미생성**, 반려 후 재요청, 요청자만 취소
  - 영업: 공급사로 수주 불가, 수주 → 작업지시 → 생산 → 부분 출하 → 출하 완료, 잔량 초과 출하 차단, **같은 수주에 10개씩 동시 출하 4건(수주 25개) → 2건만 성공**, 수주 품목이 아닌 LOT 출하 차단
  - 설비: 고장 설비 작업지시 지정 차단, 상태 변경 이력 기록
- 브라우저 E2E **30개 항목 통과** ([scripts/e2e-demo.mjs](scripts/e2e-demo.mjs)) — 위 데모 시나리오 전 과정(사용자 전환·결재 승인·출하 포함), 화면의 재고 부족 표시와 진행 차단, 언어 전환 시 입력값 유지, 새로고침 후 언어 유지, API 중복 확정·재승인·결재 우회 차단, 같은 LOT 동시 차감

### 8.3 다국어 번역 구조

- **코드는 서버, 문구는 프론트**: DB 상태·구분값과 API 오류는 고정 코드로 저장·응답하고, 프론트의 [공통코드 레지스트리](frontend/src/shared/codes.ts)가 `codes.<그룹>.<코드>` 번역 키와 배지 색으로 매핑합니다. [시스템 › 공통코드] 화면에서 코드별 한국어·영어 표시명을 그대로 확인할 수 있습니다.
- **오류 값 전달**: LOT 번호·부족 수량·수주 잔량처럼 문구에 필요한 값은 API 가 `details` 로 내려주고 `{{lotNo}}` 같은 변수로 끼워 넣습니다 ([api-error.ts](frontend/src/shared/lib/api-error.ts)).
- **유효성 메시지도 번역 키**: Zod 오류 메시지를 `validation.required` 같은 키로 두고 렌더링 시점에 `t()` 로 바꿉니다. 오류가 표시된 상태에서 언어를 바꾸면 메시지도 바로 바뀝니다.
- **언어 전환 시 상태 유지**: `i18n.changeLanguage()` 만 호출하고 화면을 다시 마운트하지 않아 라우트·검색 조건·입력 중인 값이 남습니다. 선택 언어는 `localStorage` 에 저장됩니다.
- **원문 유지**: 품번·LOT·문서번호와 사용자가 입력한 거래처명·품명·사용자명은 번역하지 않습니다. 날짜·숫자는 `Intl` 로 선택 언어에 맞춰 표시합니다.
- **누락 검사**: `npm run i18n:check` 가 언어 간 키·`{{변수}}` 일치, 소스의 정적 키, **모든 백엔드 오류 코드와 Prisma enum 값의 번역**, 공통코드 레지스트리 등록 여부를 검사합니다. 현재: `ko/en 각 496키, 코드 매핑 84개(API 오류 21개) — 누락 0`.

#### 새 언어 추가 절차 (예: 일본어 `ja`)

1. `frontend/src/i18n/locales/ko.json` 을 복사해 `ja.json` 을 만들고 값만 번역합니다 (키 구조와 `{{변수}}` 는 그대로).
2. [`frontend/src/i18n/index.ts`](frontend/src/i18n/index.ts) 에 `import ja from './locales/ja.json'` 을 추가하고 `SUPPORTED_LANGUAGES` 에 `{ code: 'ja', label: '日本語', locale: 'ja-JP' }`, `resources` 에 `ja: { translation: ja }` 를 등록합니다. 헤더의 언어 메뉴, `Intl` 로캘, 공통코드 화면의 표시명 열이 이 목록을 그대로 사용합니다.
3. `npm run i18n:check` 와 `npm test` 로 누락·변수 불일치가 없는지 확인합니다.

## 9. 향후 확장

| 구분 | 내용 |
|---|---|
| ✅ 구현됨 | 기준정보(공급사·고객사·품목·BOM), 수주·출하(수주 잔량 관리, LOT별 출하), 작업지시(수주 연계·설비 지정), 생산실적 입력과 **결재 승인 시 단일 트랜잭션 확정**, 재고 부족 표시, 중복 확정·동시 차감·동시 출하·중복 결재 방지, 품목·LOT별 현재고와 수불 이력, **입고 → 생산 → 출하 양방향 LOT 추적**, 설비 상태·이력, 사용자·권한(데모용 전환), 시스템 설정, 공통코드, 실데이터 대시보드, ko/en 다국어, 통합 테스트·E2E |
| 🔜 향후 작업 | 로그인·인증(현재는 데모용 사용자 전환), 생산실적·출하 **취소·정정**(역분개 수불), 공정별 실적(절단·성형·검사), 다단계 결재선, 수주 다품목(라인), 설비 연동·가동률 집계, 바코드·LOT 라벨 출력, POP 태블릿 화면, 재고 실사·조정, CI 파이프라인과 클라우드 배포 (Netlify 설정은 포함, 미배포) |
