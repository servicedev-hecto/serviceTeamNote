-- ============================================
-- 팀 노트 앱 데이터베이스 스키마 v2
-- ============================================

-- 1. 프로필 테이블 (사용자 정보)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  nickname text not null,
  avatar_url text, -- DiceBear API URL 저장
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 작업/일정 테이블
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  
  -- 기본 정보
  title text not null,
  content text, -- 일정 상세 내용
  date date not null, -- 배포 일자 (캘린더에 표시)
  registered_date date, -- 등록일: 일정 추가 시 캘린더에서 선택했던 날짜
  is_completed boolean default false,
  assignee text, -- 담당자 표시 (선택, 비워 둘 수 있음)
  
  -- Jira 연동 정보 (선택)
  jira_ticket_id text, -- PROJ-123
  jira_ticket_url text,
  jira_title text,
  jira_status text,
  jira_priority text,
  jira_assignee text,
  is_jira_linked boolean default false -- 쿼리 최적화 + 캘린더 색상 구분용
);

-- 3. 작업 댓글 테이블
create table public.task_comments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null
);

-- 4. 커뮤니티 게시글 테이블 (Phase 2에서 사용)
create table public.community_posts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  jira_tickets text[] -- Jira 티켓 배열
);

-- 5. 커뮤니티 댓글 테이블 (Phase 2에서 사용)
create table public.post_comments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null
);

-- ============================================
-- RLS (Row Level Security) 활성화
-- ============================================

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_comments enable row level security;

-- ============================================
-- profiles 정책
-- ============================================

-- 모든 인증된 사용자가 프로필 읽기 가능
create policy "모든 인증된 사용자가 프로필을 읽을 수 있음"
  on public.profiles for select
  to authenticated
  using (true);

-- 본인만 프로필 생성 가능
create policy "본인만 프로필 생성 가능"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인만 프로필 수정 가능
create policy "본인만 프로필 수정 가능"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id);

-- ============================================
-- tasks 정책
-- ============================================

-- 모든 인증된 사용자가 작업 읽기 가능
create policy "모든 인증된 사용자가 작업을 읽을 수 있음"
  on public.tasks for select
  to authenticated
  using (true);

-- 인증된 사용자는 작업 생성 가능
create policy "인증된 사용자는 작업 생성 가능"
  on public.tasks for insert
  to authenticated
  with check (auth.uid() = created_by);

-- 본인이 작성한 작업만 수정 가능
create policy "본인만 작업 수정 가능"
  on public.tasks for update
  to authenticated
  using (auth.uid() = created_by);

-- 본인이 작성한 작업만 삭제 가능
create policy "본인만 작업 삭제 가능"
  on public.tasks for delete
  to authenticated
  using (auth.uid() = created_by);

-- ============================================
-- task_comments 정책
-- ============================================

-- 모든 인증된 사용자가 댓글 읽기 가능
create policy "모든 인증된 사용자가 댓글을 읽을 수 있음"
  on public.task_comments for select
  to authenticated
  using (true);

-- 인증된 사용자는 댓글 작성 가능
create policy "인증된 사용자는 댓글 작성 가능"
  on public.task_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인 댓글만 수정 가능
create policy "본인만 댓글 수정 가능"
  on public.task_comments for update
  to authenticated
  using (auth.uid() = user_id);

-- 본인 댓글만 삭제 가능
create policy "본인만 댓글 삭제 가능"
  on public.task_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================
-- community_posts 정책
-- ============================================

create policy "모든 인증된 사용자가 게시글을 읽을 수 있음"
  on public.community_posts for select
  to authenticated
  using (true);

create policy "인증된 사용자는 게시글 작성 가능"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "본인만 게시글 수정 가능"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = user_id);

create policy "본인만 게시글 삭제 가능"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================
-- post_comments 정책
-- ============================================

create policy "모든 인증된 사용자가 댓글을 읽을 수 있음"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "인증된 사용자는 댓글 작성 가능"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "본인만 댓글 수정 가능"
  on public.post_comments for update
  to authenticated
  using (auth.uid() = user_id);

create policy "본인만 댓글 삭제 가능"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================
-- 인덱스 (성능 최적화)
-- ============================================

create index profiles_user_id_idx on public.profiles(user_id);
create index tasks_created_by_idx on public.tasks(created_by);
create index tasks_date_idx on public.tasks(date); -- 캘린더 날짜 조회용
create index tasks_date_jira_idx on public.tasks(date, is_jira_linked); -- 날짜별 색상 구분용
create index task_comments_task_id_idx on public.task_comments(task_id);
create index task_comments_user_id_idx on public.task_comments(user_id);
create index community_posts_user_id_idx on public.community_posts(user_id);
create index post_comments_post_id_idx on public.post_comments(post_id);

-- ============================================
-- 트리거: updated_at 자동 업데이트
-- ============================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute procedure public.handle_updated_at();

create trigger set_updated_at_tasks
  before update on public.tasks
  for each row
  execute procedure public.handle_updated_at();

create trigger set_updated_at_task_comments
  before update on public.task_comments
  for each row
  execute procedure public.handle_updated_at();

create trigger set_updated_at_community_posts
  before update on public.community_posts
  for each row
  execute procedure public.handle_updated_at();

create trigger set_updated_at_post_comments
  before update on public.post_comments
  for each row
  execute procedure public.handle_updated_at();

-- ============================================
-- 트리거: 회원가입 시 프로필 자동 생성
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_seed text;
  username text;
begin
  -- 이메일에서 @ 앞부분 추출
  username := split_part(new.email, '@', 1);
  
  -- 랜덤 시드 생성 (DiceBear용)
  random_seed := encode(gen_random_bytes(16), 'hex');
  
  insert into public.profiles (user_id, nickname, avatar_url)
  values (
    new.id,
    username,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || random_seed
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
  

-- ============================================
-- 🔧 트리거 수정 (기존 DB에 적용할 경우만 실행)
-- ============================================
-- 아래 SQL만 복사해서 Supabase SQL Editor에서 실행하세요

/*
-- DiceBear 제거하고 avatar_url을 null로 변경
create or replace function public.handle_new_user()
returns trigger as $$
declare
  username text;
begin
  -- 이메일에서 @ 앞부분 추출
  username := split_part(new.email, '@', 1);
  
  -- 프로필 생성 (avatar_url은 NULL, 이미지 업로드 시에만 저장)
  insert into public.profiles (user_id, nickname, avatar_url)
  values (
    new.id,
    username,
    null
  );
  return new;
end;
$$ language plpgsql security definer;
*/

-- ============================================
-- 기존 DB 마이그레이션 (예전 스크립트로 tasks만 만든 경우)
-- Supabase → SQL Editor → 아래 각 줄 붙여넣기 → Run
-- 한 번만 성공하면 되고, 이미 컬럼이 있으면 IF NOT EXISTS 때문에 해가 되지 않습니다.
-- ============================================

-- 담당자(assignee) — 일정 모달·저장에 필요
alter table public.tasks add column if not exists assignee text;

-- 등록일(registered_date) — 캘린더에서 일정 추가 시 선택한 날짜 저장
alter table public.tasks add column if not exists registered_date date;

-- ============================================
-- 6. 팀 계정 모음 테이블
-- ============================================

create table public.team_accounts (
  id uuid default gen_random_uuid() primary key,
  service_name text not null,
  account_id text not null,
  account_password text not null,
  url text,
  memo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.team_accounts enable row level security;

create policy "인증된 사용자는 팀 계정 조회 가능"
  on public.team_accounts for select
  to authenticated using (true);

create policy "인증된 사용자는 팀 계정 추가 가능"
  on public.team_accounts for insert
  to authenticated with check (true);

create policy "인증된 사용자는 팀 계정 수정 가능"
  on public.team_accounts for update
  to authenticated using (true);

create policy "인증된 사용자는 팀 계정 삭제 가능"
  on public.team_accounts for delete
  to authenticated using (true);

create trigger set_updated_at_team_accounts
  before update on public.team_accounts
  for each row
  execute procedure public.handle_updated_at();
