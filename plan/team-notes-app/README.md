# 팀 노트 (Team Notes App)

헥토 헬스케어 서비스팀용 **내부 업무 노트·월 캘린더** 웹앱입니다. 인증·프로필·일정(`tasks`)·댓글은 Supabase와 연동됩니다. Jira 티켓 조회는 서버 API(`/api/jira/issue`)로 선택 연동 가능합니다. 커뮤니티 테이블은 스키마만 준비된 상태입니다.

## 기술 스택

- **Next.js** 16 (App Router) · **React** 19 · **TypeScript**
- **Tailwind CSS** v4
- **Supabase** (Auth, Postgres, Storage — 프로필 아바타)

## 빠른 시작

```bash
cd team-notes-app
npm install
# .env.local 에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 설정 (SETUP.md 참고)
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) — 루트는 `/login`으로 리다이렉트됩니다.

환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (자세한 설정은 [SETUP.md](./SETUP.md))

## 문서

| 파일 | 내용 |
|------|------|
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | 구현 현황, DB 스키마 요약, 로드맵, 폴더 구조 |
| [SETUP.md](./SETUP.md) | Supabase 테이블 생성, 트러블슈팅 |
| [supabase-schema.sql](./supabase-schema.sql) | Postgres DDL · RLS · 트리거 (원본) |

## 라우트 개요

- `/` — 로그인으로 이동, 비밀번호 재설정용 `code`·에러 쿼리 처리
- `/login` — 로그인 · 회원가입 · 비밀번호 찾기
- `/auth/callback` — PKCE 세션 교환
- `/reset-password` — 비밀번호 재설정
- `/month` — 월 캘린더(메인), 프로필 · 공휴일 API 프록시 사용

공휴일: **`/api/holidays`**. Jira: 일정 모달에서 **`/api/jira/issue?key=...`** (서버에 `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` 필요).
