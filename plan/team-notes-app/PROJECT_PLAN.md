# Service Team Note - 프로젝트 현황 및 개발 계획

> Last updated: 2026-03-27 (일정 DB 연동 반영)

---

## 📌 프로젝트 개요

- **기술 스택**: Next.js 16.1 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **접근 제한**: `@hecto.co.kr` 이메일만 폼 검증 통과 (`lib/validation.ts`). 서버 전역 미들웨어 도메인 차단은 없음 — Supabase Auth 정책과 병행 검토 여지 있음.
- **목적**: 헥토 헬스케어 서비스팀 내부 업무 노트 & 일정 관리

---

## ✅ 현재 구현된 기능

### 인증 (Auth)
| 기능 | 상태 | 설명 |
|------|------|------|
| 이메일/비밀번호 로그인 | ✅ | `signInWithPassword`, hecto.co.kr 도메인 검증 |
| 회원가입 | ✅ | `signUp`, 이메일 인증 후 로그인 |
| 로그아웃 | ✅ | 헤더 드롭다운 · 프로필 모달 |
| 비밀번호 찾기 | ✅ | 모달 → 메일 발송 → `/auth/callback` → `/reset-password` |
| 비밀번호 재설정 | ✅ | PKCE 방식, 강도 표시, 일치 확인 |
| URL 에러 처리 | ✅ | 만료/거부 링크 시 한글 안내 메시지 (`/login`) |
| 비밀번호 표시 토글 | ✅ | 로그인 폼 입력란 옆 눈 아이콘 (`type` text/password 전환) |

### 프로필 (Profile)
| 기능 | 상태 | 설명 |
|------|------|------|
| 프로필 조회 | ✅ | `profiles` 테이블, 닉네임·아바타 |
| 닉네임 수정 | ✅ | 한글·영문·숫자·공백 허용 |
| 아바타 업로드 | ✅ | Supabase Storage `profiles` 버킷, 5MB 제한 |
| 이메일·가입일 표시 | ✅ | 읽기 전용 |

### 월 캘린더 (Month View)
| 기능 | 상태 | 설명 |
|------|------|------|
| 월 그리드 캘린더 | ✅ | 일요일 시작, 빈 칸 패딩 |
| 월 이동 | ✅ | 버튼 · 좌우 스와이프(50px) · 키보드(← →) |
| 날짜 선택 | ✅ | 우측 패널에 요일·일 표시 |
| 오늘 버튼 | ✅ | 현재 날짜로 이동 |
| 공휴일 표시 | ✅ | `app/api/holidays/route.ts` 프록시 → 한국천문연구원 API, 캘린더 점 표시 |
| 공휴일 카드 | ✅ | 선택일이 공휴일이면 카드 표시 |
| 일정 DB 연동 | ✅ | 월 범위 `tasks` 조회, 날짜별 캘린더 배지(건수·Jira 여부 색) |
| 일정 CRUD | ✅ | 모달 등록/수정, 삭제 확인, 완료 체크 |
| 담당자 | ✅ | `assignee` 컬럼(선택), 스키마 마이그레이션 필요 시 SQL 파일 하단 |
| Jira 필드(수동) | ✅ | 티켓 키·URL 입력 시 `is_jira_linked` 설정, 링크 표시 |
| 일정별 댓글 | ✅ | 선택 일정 기준 `task_comments` 조회·등록 |

### 헤더 (Header)
| 기능 | 상태 | 설명 |
|------|------|------|
| 로고 표시 | ✅ | |
| 프로필 아바타/닉네임 | ✅ | 없으면 이니셜 표시 |
| 드롭다운 메뉴 | ✅ | 프로필 편집, 로그아웃 |

---

## 🚧 미구현 · 부분 구현

### 일정 / Jira (추가 예정)
| 기능 | 상태 | 비고 |
|------|------|------|
| Jira API 자동 조회 | ❌ | 티켓 번호 검색 → 제목·날짜 반영 등 |
| `jira_title` 등 서버 동기화 | ❌ | 현재는 수동 입력(키·URL)만 |

### 작업 댓글
| 기능 | 상태 | 비고 |
|------|------|------|
| 댓글 수정/삭제 | ❌ | RLS는 본인만 가능, UI 미구현 |

### 커뮤니티 게시판 (Community) — Phase 2
| 기능 | 상태 | 비고 |
|------|------|------|
| 게시글 작성/조회 | ❌ 미구현 | `community_posts` 테이블만 있음 |
| 게시글 댓글 | ❌ 미구현 | `post_comments` 테이블만 있음 |
| Jira 티켓 태그 | ❌ 미구현 | `jira_tickets text[]` 컬럼 있음 |

---

## 🗄️ DB 테이블 구조 (`supabase-schema.sql` 기준)

### `profiles`
```
id          uuid PK (gen_random_uuid)
user_id     uuid UNIQUE → auth.users (CASCADE)
nickname    text NOT NULL
avatar_url  text (nullable, 스키마 주석: DiceBear URL 또는 업로드 URL)
created_at  timestamptz DEFAULT utc now
updated_at  timestamptz (트리거로 자동 갱신)
```

### `tasks`
```
id              uuid PK
created_at      timestamptz
updated_at      timestamptz (트리거)
created_by      uuid → auth.users NOT NULL
title           text NOT NULL
content         text
date            date NOT NULL  ← 캘린더 날짜
is_completed    boolean DEFAULT false
assignee        text (nullable)

-- Jira 연동 필드
jira_ticket_id  text
jira_ticket_url text
jira_title      text
jira_status     text
jira_priority   text
jira_assignee   text
is_jira_linked  boolean DEFAULT false
```

### `task_comments`
```
id          uuid PK
created_at  timestamptz
updated_at  timestamptz (트리거)
task_id     uuid → tasks(id) CASCADE DELETE
user_id     uuid → auth.users
content     text NOT NULL
```

### `community_posts`
```
id           uuid PK
created_at   timestamptz
updated_at   timestamptz (트리거)
user_id      uuid → auth.users
title        text NOT NULL
content      text NOT NULL
jira_tickets text[]
```

### `post_comments`
```
id          uuid PK
created_at  timestamptz
updated_at  timestamptz (트리거)
post_id     uuid → community_posts(id) CASCADE DELETE
user_id     uuid → auth.users
content     text NOT NULL
```

### RLS 정책 (공통)
- 인증된 사용자는 전체 조회 가능
- 본인 데이터만 INSERT / UPDATE / DELETE 가능 (`tasks`는 `created_by` 기준)

### 트리거
- 위 테이블들: `UPDATE` 시 `updated_at` 자동 갱신 (`handle_updated_at`)
- `auth.users` INSERT 시 `handle_new_user` → `profiles` 자동 생성 (이메일 로컬파트 = nickname, DiceBear 시드 URL 또는 마이그레이션 주석대로 `avatar_url` null)

---

## ⚠️ 기술 부채

| 항목 | 내용 |
|------|------|
| `types/database.types.ts` | `Task` 등 수동 정의로 스키마와 정렬됨. 장기적으로 Supabase CLI `gen types` 권장. |
| `Profile` / `profiles` 행 타입 | 컴포넌트에서 `any` 혼용 — 점진적 타입 통일 여지 |
| `lib/supabase/server.ts` | `createClient()` 정의되어 있으나 **현재 import 사용처 없음** (`/auth/callback`은 인라인 `createServerClient`) |

---

## 🗺️ 개발 우선순위 제안

### Phase 1 — 핵심 기능 (현재)
- [x] 인증 (로그인 · 회원가입 · 비밀번호 찾기 · 재설정)
- [x] 프로필 (닉네임 · 아바타)
- [x] 월 캘린더 · 공휴일 표시 (`/api/holidays`)

### Phase 2 — 일정 관리
- [x] `tasks` DB 연동 (월 범위 조회, 날짜별 캘린더 반영)
- [x] 일정 카드 UI · 모달 등록/수정/삭제
- [x] 일정 완료 체크
- [x] `task_comments` 댓글 조회·작성
- [ ] 댓글 수정/삭제 UI
- [ ] Jira API 연동 (검색·제목·날짜 자동 반영)

### Phase 3 — Jira 연동
- [x] 수동 티켓 키·URL · `is_jira_linked` 표시
- [ ] Jira API

### Phase 4 — 커뮤니티
- [ ] `community_posts` 게시판 페이지
- [ ] `post_comments` 댓글
- [ ] Jira 티켓 태그

---

## 📁 프로젝트 구조

```
team-notes-app/
├── app/
│   ├── page.tsx                  # / → PKCE code·error 처리 후 /login 또는 callback
│   ├── layout.tsx                # 루트 레이아웃 (Pretendard 등)
│   ├── globals.css
│   ├── login/page.tsx            # 로그인 · 회원가입 · 비밀번호 찾기
│   ├── month/page.tsx            # 메인 월 캘린더 · Header · Profile 모달
│   ├── reset-password/page.tsx   # 비밀번호 재설정
│   ├── auth/callback/route.ts    # PKCE 코드 교환 (쿠키 설정)
│   └── api/holidays/route.ts     # 공휴일 API 프록시
├── components/
│   ├── Header.tsx
│   ├── Profile.tsx               # 프로필 편집 모달
│   └── TaskModal.tsx             # 일정 등록/수정 모달
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # 브라우저용 Supabase
│   │   └── server.ts             # 서버용 (미사용)
│   ├── validation.ts             # 이메일(hecto) · 비밀번호 검증
│   └── holidays.ts               # 공휴일 API 유틸
├── types/
│   └── database.types.ts         # 수동 타입 (스키마와 불일치 구간 있음)
├── public/                       # 로고 등 정적 파일
├── supabase-schema.sql           # DB 스키마 DDL
├── SETUP.md
├── PROJECT_PLAN.md               # 이 파일
└── README.md
```
