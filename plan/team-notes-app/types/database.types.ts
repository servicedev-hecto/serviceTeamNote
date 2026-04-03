// Supabase public 스키마와 맞춘 타입 (수동 관리)

/** 일정 / 배포 태스크 (`public.tasks`) */
export interface Task {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  title: string
  content: string | null
  /** 배포일 (선택 — null이면 등록일에만 노출) */
  date: string | null
  /** 등록일: 이슈 등록 시 캘린더에서 선택한 날짜 */
  registered_date: string | null
  /** 상태: 시작전 | 개발중 | 개발완료 */
  status: string | null
  dev_type: string | null
  assignee: string | null
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  jira_title: string | null
  jira_status: string | null
  jira_priority: string | null
  jira_assignee: string | null
  is_jira_linked: boolean
  is_event: boolean
  has_page: boolean
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

export type TaskUpdate = Partial<Omit<Task, 'id' | 'created_by'>>

/** 작업 댓글 (`public.task_comments`) */
export interface TaskComment {
  id: string
  created_at: string
  updated_at: string
  task_id: string
  user_id: string
  content: string
}

export interface CommunityPost {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  title: string
  content: string
  jira_tickets?: string[]
}

export interface PostComment {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  post_id: string
  content: string
}
