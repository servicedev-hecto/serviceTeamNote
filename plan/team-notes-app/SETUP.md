# 팀 노트 앱 설정 가이드

## ✅ 현재까지 반영된 작업 (요약)

1. Next.js 16 · React 19 · Tailwind v4 프로젝트
2. Supabase 클라이언트 (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
3. `supabase-schema.sql` — 테이블 · RLS · `updated_at` 트리거 · 가입 시 `profiles` 자동 생성
4. 인증 플로우: `/login`, `/auth/callback`, `/reset-password`, 루트(`/`)의 code·error 리다이렉트
5. `@hecto.co.kr` 이메일 검증 (`lib/validation.ts`)
6. `/month` 월 캘린더, 프로필(닉네임·아바타·Storage), 헤더
7. 공휴일: `app/api/holidays/route.ts` + `lib/holidays.ts`
8. 일정·댓글: `tasks` / `task_comments` 연동 (`/month`), Jira 조회: `app/api/jira/issue/route.ts` (환경 변수 선택)

**아직 앱에서 쓰지 않는 DB 영역**: `community_posts`, `post_comments`

---

## 🔧 새 환경에서 할 일

### 1. 의존성 및 환경 변수

```bash
npm install
```

프로젝트 루트에 `.env.local` 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...   # Supabase Dashboard → Settings → API 의 anon / publishable key
```

(구 문서의 `anon` 키와 동일 역할이며, 현재 코드는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 이름을 사용합니다.)

### Jira 티켓 조회 (일정 등록 모달의「티켓 조회」)

서버에서만 호출되므로 **브라우저에 노출되지 않습니다.** 아래를 `.env.local`에 넣습니다.

| 변수 | 설명 |
|------|------|
| `JIRA_HOST` | 사이트 베이스 URL (끝에 `/` 없이). 예: `https://your-company.atlassian.net` (Cloud) 또는 사내 Jira `https://jira.example.com` |
| `JIRA_EMAIL` | Jira Cloud: Atlassian 계정 **이메일** (로그인에 쓰는 주소) |
| `JIRA_API_TOKEN` | [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) 에서 발급한 토큰 |

```env
JIRA_HOST=https://your-company.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your_api_token
```

- **인증 방식**: Cloud 기본은 **Basic Auth** (`이메일:API토큰` Base64). 토큰은 패스워드가 아니라 API 토큰만 사용합니다.
- **권한**: 해당 토큰을 만든 계정이 티켓을 **볼 수 있어야** 조회됩니다.
- **Data Center / Server**: 같은 REST 경로(`/rest/api/3/issue/{key}`)를 쓰는 경우가 많습니다. 404면 관리자에게 API 버전(2/3)과 호스트 URL을 확인하세요.
- 변수를 비우면 조회 시「연동이 설정되지 않았습니다」메시지가 뜹니다. Jira 없이 일정만 쓰는 것은 그대로 가능합니다.

### 2. Supabase에서 테이블 생성

1. [Supabase 대시보드](https://supabase.com/dashboard) → **SQL Editor**
2. **New Query** → 저장소의 `supabase-schema.sql` 전체 실행 (**Run**)

**이미 예전 스크립트로 `tasks`만 만든 경우** SQL Editor에서 필요한 줄만 실행:

```sql
alter table public.tasks add column if not exists assignee text;
alter table public.tasks add column if not exists registered_date date;
```

스토리지: 프로필 이미지용 `profiles` 버킷은 대시보드에서 생성하고, 앱에서 사용하는 RLS/정책이 있다면 동일하게 맞춥니다.

### 3. 개발 서버

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) → `/login` → 가입/로그인 후 `/month`

---

## 📁 프로젝트 구조 (주요 경로)

```
team-notes-app/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/page.tsx
│   ├── month/page.tsx
│   ├── reset-password/page.tsx
│   ├── auth/callback/route.ts
│   └── api/
│       ├── holidays/route.ts
│       └── jira/issue/route.ts   # 티켓 조회 (JIRA_* 환경 변수)
├── components/
│   ├── Header.tsx
│   └── Profile.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── validation.ts
│   └── holidays.ts
├── types/
│   └── database.types.ts
├── public/
├── supabase-schema.sql
├── README.md
├── PROJECT_PLAN.md      # 구현 현황 · 로드맵
└── SETUP.md             # 이 파일
```

---

## 🎯 다음 단계 (로드맵과 동일)

1. **`tasks` 연동** — 캘린더 날짜(`date`) 기준 CRUD, 타입은 `types/database.types.ts`를 스키마에 맞게 정리
2. **`task_comments`** — 일정별 댓글
3. **Jira 필드** — UI에서 `is_jira_linked` 및 Jira 컬럼 활용
4. **커뮤니티** — `community_posts` / `post_comments`

상세 체크리스트는 [PROJECT_PLAN.md](./PROJECT_PLAN.md)를 참고하세요.

---

## 🐛 문제 해결

### 로그인이 안 되는 경우
1. Supabase → Settings → API에서 URL·키 확인
2. `.env.local` 키 이름이 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`인지 확인
3. 개발 서버 재시작 (`npm run dev`)

### 이메일 확인이 안 오는 경우
1. Authentication → Providers / 이메일 설정에서 확인 메일 활성화 여부
2. 스팸함 확인

### 공휴일이 안 나오는 경우
1. 네트워크 탭에서 `/api/holidays?year=YYYY` 응답 확인
2. 한국천문연구원 API 장애 시 해당 연도만 비어 있을 수 있음

---

## 📚 React 기본 개념 (Vue 비교)

| Vue | React |
|-----|-------|
| `<template>` | JSX |
| `ref()` | `useState()` |
| `computed` | `useMemo()` / `useCallback()` |
| `watch` | `useEffect()` |
| `v-if` | `{condition && <div>}` |
| `v-for` | `{array.map(...)}` |
| `@click` | `onClick` |
| `:class` | `className` |

---

## 🚀 배포 (참고)

Vercel 등에 배포 시 **동일한 환경 변수**를 프로젝트 설정에 넣어야 합니다.
