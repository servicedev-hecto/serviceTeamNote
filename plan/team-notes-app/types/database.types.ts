// Supabase public 스키마와 맞춘 타입 (수동 관리)

/** 일정 / 배포 태스크 (`public.tasks`) */
export interface Task {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  title: string
  content: string | null
  date: string
  /** 캘린더에서「일정 추가」할 때 선택했던 날짜 (없으면 예전 행은 created_at 날짜로 표시) */
  registered_date: string | null
  is_completed: boolean
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
