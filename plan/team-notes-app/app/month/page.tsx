'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { fetchHolidays, formatDateKey } from '@/lib/holidays'
import Header from '@/components/Header'
import Profile from '@/components/Profile'
import TaskModal from '@/components/TaskModal'
import AccountsModal from '@/components/AccountsModal'
import WeeklyReportModal from '@/components/WeeklyReportModal'
import type { Task } from '@/types/database.types'

function getMonthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { start: formatDateKey(first), end: formatDateKey(last) }
}

/** 일요일 시작 (월간 그리드와 동일) */
function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = x.getDay()
  x.setDate(x.getDate() - dow)
  return x
}

function getWeekRange(anchor: Date): { start: string; end: string } {
  const s = startOfWeekSunday(anchor)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return { start: formatDateKey(s), end: formatDateKey(e) }
}

function weekDatesFromAnchor(anchor: Date): Date[] {
  const s = startOfWeekSunday(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(s)
    d.setDate(s.getDate() + i)
    return d
  })
}

function groupTasksByDate(tasks: Task[], rangeStart?: string, rangeEnd?: string): Record<string, Task[]> {
  const map: Record<string, Task[]> = {}
  const today = formatDateKey(new Date())

  const addToDate = (key: string, task: Task) => {
    if (!map[key]) map[key] = []
    if (!map[key].find((x) => x.id === task.id)) map[key].push(task)
  }

  for (const t of tasks) {
    if (t.date) {
      // 등록일 ~ 배포일 매일 노출 (range 내에서만)
      if (t.registered_date && rangeStart && rangeEnd) {
        const spreadStart = t.registered_date > rangeStart ? t.registered_date : rangeStart
        const spreadEnd = t.date < rangeEnd ? t.date : rangeEnd
        const cur = new Date(spreadStart)
        const endDate = new Date(spreadEnd)
        while (cur <= endDate) {
          addToDate(formatDateKey(cur), t)
          cur.setDate(cur.getDate() + 1)
        }
      } else {
        addToDate(t.date, t)
      }
    } else {
      // 배포일 없음: 등록일에만 노출
      if (t.registered_date) {
        addToDate(t.registered_date, t)
      }
    }
  }

  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return map
}

type CommentRow = {
  id: string
  content: string
  created_at: string
  user_id: string
  nickname: string
}

export default function MonthPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [holidays, setHolidays] = useState<Record<string, string>>({})
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showAccountsModal, setShowAccountsModal] = useState(false)
  const [showWeeklyReport, setShowWeeklyReport] = useState(false)

  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())

  const [tasks, setTasks] = useState<Task[]>([])
  const [authorByUserId, setAuthorByUserId] = useState<Record<string, string>>({})
  const [avatarByNickname, setAvatarByNickname] = useState<Record<string, string>>({})
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit'>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  /** 일정 추가 모달을 열 때 캘린더에 선택되어 있던 날짜 (= 등록일) */
  const [registerCalendarDateKey, setRegisterCalendarDateKey] = useState('')

  const [filterAssignee, setFilterAssignee] = useState<string | null>(null)

  const [comments, setComments] = useState<CommentRow[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const minSwipeDistance = 50

  const tasksByDate = useMemo(() => {
    let rangeStart: string
    let rangeEnd: string
    if (calendarView === 'month') {
      const r = getMonthRange(currentMonth)
      rangeStart = r.start
      rangeEnd = r.end
    } else {
      const r = getWeekRange(weekAnchor)
      rangeStart = r.start
      rangeEnd = r.end
    }
    return groupTasksByDate(tasks, rangeStart, rangeEnd)
  }, [tasks, calendarView, currentMonth, weekAnchor])

  const loadProfile = async () => {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()

    if (!u) {
      router.push('/login')
      return
    }

    setUser({ id: u.id, email: u.email })

    const { data: profileData } = await supabase.from('profiles').select('*').eq('user_id', u.id).single()

    setProfile(profileData)
    setLoading(false)
  }

  const loadTasks = useCallback(async () => {
    if (!user) return
    setTaskLoadError(null)
    let start: string
    let end: string
    if (calendarView === 'month') {
      const r = getMonthRange(currentMonth)
      start = r.start
      end = r.end
    } else {
      const r = getWeekRange(weekAnchor)
      const sk = formatDateKey(selectedDate)
      start = r.start
      end = r.end
      if (sk < start) start = sk
      if (sk > end) end = sk
    }
    // 1) 배포일이 기간 내인 태스크
    const { data: data1, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })

    // 2) 배포일이 기간 이후 — 등록일이 기간에 걸치는 태스크
    const { data: data2 } = await supabase
      .from('tasks')
      .select('*')
      .gt('date', end)
      .lte('registered_date', end)

    // 3) 배포일이 기간 이전 — 등록일이 기간 내인 태스크 (배포 완료, 줄긋기용)
    const { data: data3 } = await supabase
      .from('tasks')
      .select('*')
      .lt('date', start)
      .gte('registered_date', start)
      .lte('registered_date', end)

    // 4) 배포일 없음 + 등록일이 기간 내인 태스크
    const { data: data4 } = await supabase
      .from('tasks')
      .select('*')
      .is('date', null)
      .gte('registered_date', start)
      .lte('registered_date', end)

    const seen = new Set<string>()
    const merged = [...(data1 || []), ...(data2 || []), ...(data3 || []), ...(data4 || [])].filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    const data = merged

    if (error) {
      console.error('tasks load error:', error.message)
      const msg = error.message
      setTaskLoadError(
        msg.includes('assignee')
          ? 'DB에 assignee 컬럼이 없습니다. supabase-schema.sql 하단 마이그레이션을 실행해주세요.'
          : msg.includes('registered_date')
            ? 'DB에 registered_date 컬럼이 없습니다. supabase-schema.sql 하단 마이그레이션을 실행해주세요.'
            : '일정을 불러오지 못했습니다.'
      )
      setTasks([])
      setAuthorByUserId({})
      return
    }
    const rows = (data as Task[]) || []
    const creatorIds = [...new Set(rows.map((t) => t.created_by))]
    let nickMap: Record<string, string> = {}
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, nickname, avatar_url').in('user_id', creatorIds)
      nickMap = Object.fromEntries(
        (profs || []).map((p: { user_id: string; nickname: string; avatar_url: string | null }) => [p.user_id, p.nickname])
      )
      const avatarMap: Record<string, string> = {}
      ;(profs || []).forEach((p: { user_id: string; nickname: string; avatar_url: string | null }) => {
        if (p.nickname && p.avatar_url) avatarMap[p.nickname] = p.avatar_url
      })
      setAvatarByNickname(avatarMap)
    }
    setAuthorByUserId(nickMap)
    setTasks(rows)
  }, [supabase, user, currentMonth, calendarView, weekAnchor, selectedDate])

  useEffect(() => {
    loadProfile()
  }, [router, supabase])

  useEffect(() => {
    if (user) loadTasks()
  }, [user, loadTasks])

  useEffect(() => {
    const key = formatDateKey(selectedDate)
    const dayTasks = tasksByDate[key] || []
    setSelectedTaskId((prev) => {
      if (prev && dayTasks.some((t) => t.id === prev)) return prev
      return dayTasks[0]?.id ?? null
    })
  }, [selectedDate, tasksByDate])

  useEffect(() => {
    const loadHolidays = async () => {
      if (calendarView === 'month') {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1
        const holidayData = await fetchHolidays(year, month)
        setHolidays(holidayData)
        return
      }
      const days = weekDatesFromAnchor(weekAnchor)
      const ym = new Set(days.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`))
      const merged: Record<string, string> = {}
      for (const key of ym) {
        const [y, m] = key.split('-').map(Number)
        const part = await fetchHolidays(y, m)
        Object.assign(merged, part)
      }
      setHolidays(merged)
    }

    loadHolidays()
  }, [currentMonth, calendarView, weekAnchor])

  useEffect(() => {
    if (calendarView !== 'week') return
    const { start, end } = getWeekRange(weekAnchor)
    setSelectedDate((prev) => {
      const sk = formatDateKey(prev)
      if (sk < start || sk > end) {
        return startOfWeekSunday(weekAnchor)
      }
      return prev
    })
  }, [calendarView, weekAnchor])

  useEffect(() => {
    if (!selectedTaskId) {
      setComments([])
      return
    }

    const run = async () => {
      const { data: rows, error } = await supabase
        .from('task_comments')
        .select('id, content, created_at, user_id')
        .eq('task_id', selectedTaskId)
        .order('created_at', { ascending: true })

      if (error || !rows) {
        setComments([])
        return
      }

      const ids = [...new Set(rows.map((r) => r.user_id as string))]
      const { data: profs } = await supabase.from('profiles').select('user_id, nickname').in('user_id', ids)
      const nick: Record<string, string> = Object.fromEntries(
        (profs || []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname])
      )

      setComments(
        rows.map((r) => ({
          id: r.id as string,
          content: r.content as string,
          created_at: r.created_at as string,
          user_id: r.user_id as string,
          nickname: nick[r.user_id as string] || '사용자',
        }))
      )
    }

    run()
  }, [selectedTaskId, supabase])

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() - 1)
    setCurrentMonth(newMonth)
  }

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(newMonth.getMonth() + 1)
    setCurrentMonth(newMonth)
  }

  const goToToday = () => {
    const t = new Date()
    setCurrentMonth(t)
    setSelectedDate(t)
    setWeekAnchor(t)
  }

  const goToPreviousWeek = () => {
    setWeekAnchor((prev) => {
      const n = new Date(prev)
      n.setDate(n.getDate() - 7)
      return n
    })
  }

  const goToNextWeek = () => {
    setWeekAnchor((prev) => {
      const n = new Date(prev)
      n.setDate(n.getDate() + 7)
      return n
    })
  }

  const goThisWeek = () => {
    const t = new Date()
    setWeekAnchor(t)
    setSelectedDate(t)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (calendarView === 'week') {
      if (isLeftSwipe) goToNextWeek()
      if (isRightSwipe) goToPreviousWeek()
    } else {
      if (isLeftSwipe) goToNextMonth()
      if (isRightSwipe) goToPreviousMonth()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        if (e.key === 'ArrowLeft') goToPreviousDay()
        else if (e.key === 'ArrowRight') goToNextDay()
      } else {
        if (e.key === 'ArrowLeft') {
          if (calendarView === 'week') goToPreviousWeek()
          else goToPreviousMonth()
        } else if (e.key === 'ArrowRight') {
          if (calendarView === 'week') goToNextWeek()
          else goToNextMonth()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [calendarView, currentMonth, selectedDate, weekAnchor])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    return { daysInMonth, startDayOfWeek }
  }

  const generateCalendarDays = () => {
    const { daysInMonth, startDayOfWeek } = getDaysInMonth(currentMonth)
    const days: (number | null)[] = []

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    )
  }

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
    if (newDate.getMonth() !== selectedDate.getMonth()) {
      setCurrentMonth(newDate)
    }
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
    if (newDate.getMonth() !== selectedDate.getMonth()) {
      setCurrentMonth(newDate)
    }
  }

  const isSelectedDate = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedMonthIndex() &&
      currentMonth.getFullYear() === selectedYear()
    )
  }

  function selectedMonthIndex() {
    return selectedDate.getMonth()
  }

  function selectedYear() {
    return selectedDate.getFullYear()
  }

  const getHolidayInfo = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dateKey = formatDateKey(date)
    return holidays[dateKey]
  }

  const openCreateModal = () => {
    setRegisterCalendarDateKey(formatDateKey(selectedDate))
    setTaskModalMode('create')
    setEditingTask(null)
    setTaskModalOpen(true)
  }

  const openEditModal = (task: Task) => {
    setTaskModalMode('edit')
    setEditingTask(task)
    setTaskModalOpen(true)
  }

  const handleModalSubmit = async (payload: {
    title: string
    content: string
    date: string
    registered_date: string | null
    assignee: string
    status: string
    dev_type: string
    is_event: boolean
    has_page: boolean
    jira_ticket_id: string
    jira_ticket_url: string
    jira_title: string | null
    jira_status: string | null
    jira_priority: string | null
    jira_assignee: string | null
  }) => {
    if (!user) throw new Error('로그인이 필요합니다')

    const jiraLinked = !!(payload.jira_ticket_id || payload.jira_ticket_url)

    if (taskModalMode === 'create') {
      const regDate = payload.registered_date?.trim() || null
      const { error } = await supabase.from('tasks').insert({
        created_by: user.id,
        title: payload.title,
        content: payload.content || null,
        date: payload.date || null,
        registered_date: regDate,
        assignee: payload.assignee || null,
        status: payload.status || '시작전',
        dev_type: payload.dev_type || null,
        is_event: payload.is_event,
        has_page: payload.has_page,
        jira_ticket_id: payload.jira_ticket_id || null,
        jira_ticket_url: payload.jira_ticket_url || null,
        jira_title: jiraLinked ? payload.jira_title : null,
        jira_status: jiraLinked ? payload.jira_status : null,
        jira_priority: jiraLinked ? payload.jira_priority : null,
        jira_assignee: jiraLinked ? payload.jira_assignee : null,
        is_jira_linked: jiraLinked,
      })
      if (error) throw new Error(error.message)
    } else if (editingTask) {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: payload.title,
          content: payload.content || null,
          date: payload.date || null,
          assignee: payload.assignee || null,
          status: payload.status || '시작전',
          dev_type: payload.dev_type || null,
          is_event: payload.is_event,
          has_page: payload.has_page,
          jira_ticket_id: payload.jira_ticket_id || null,
          jira_ticket_url: payload.jira_ticket_url || null,
          jira_title: jiraLinked ? payload.jira_title : null,
          jira_status: jiraLinked ? payload.jira_status : null,
          jira_priority: jiraLinked ? payload.jira_priority : null,
          jira_assignee: jiraLinked ? payload.jira_assignee : null,
          is_jira_linked: jiraLinked,
        })
        .eq('id', editingTask.id)
      if (error) throw new Error(error.message)
    }

    await loadTasks()
    const navDate = payload.date || payload.registered_date
    if (navDate && navDate !== formatDateKey(selectedDate)) {
      const [y, mo, da] = navDate.split('-').map(Number)
      setSelectedDate(new Date(y, mo - 1, da))
      setCurrentMonth(new Date(y, mo - 1, 1))
    }
  }

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm('이 일정을 삭제할까요? 댓글도 함께 삭제됩니다.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      alert(error.message)
      return
    }
    if (selectedTaskId === task.id) setSelectedTaskId(null)
    await loadTasks()
  }

  const handlePostComment = async () => {
    if (!selectedTaskId || !user || !commentText.trim()) return
    setCommentSubmitting(true)
    const { error } = await supabase.from('task_comments').insert({
      task_id: selectedTaskId,
      user_id: user.id,
      content: commentText.trim(),
    })
    setCommentSubmitting(false)
    if (error) {
      alert(error.message)
      return
    }
    setCommentText('')
    const { data: rows } = await supabase
      .from('task_comments')
      .select('id, content, created_at, user_id')
      .eq('task_id', selectedTaskId)
      .order('created_at', { ascending: true })
    if (rows) {
      const ids = [...new Set(rows.map((r) => r.user_id as string))]
      const { data: profs } = await supabase.from('profiles').select('user_id, nickname').in('user_id', ids)
      const nick: Record<string, string> = Object.fromEntries(
        (profs || []).map((p: { user_id: string; nickname: string }) => [p.user_id, p.nickname])
      )
      setComments(
        rows.map((r) => ({
          id: r.id as string,
          content: r.content as string,
          created_at: r.created_at as string,
          user_id: r.user_id as string,
          nickname: nick[r.user_id as string] || '사용자',
        }))
      )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  const calendarDays = generateCalendarDays()
  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const selectedKey = formatDateKey(selectedDate)
  const dayTasksAll = tasksByDate[selectedKey] || []
  const dayTasks = filterAssignee
    ? dayTasksAll.filter((t) => t.assignee?.split(',').map((s) => s.trim()).includes(filterAssignee))
    : dayTasksAll
  const selectedTask = dayTasksAll.find((t) => t.id === selectedTaskId) ?? null

  const weekDates = weekDatesFromAnchor(weekAnchor)
  const weekStartDate = weekDates[0]!
  const weekEndDate = weekDates[6]!
  const weekRangeLabel = `${weekStartDate.getFullYear()}년 ${weekStartDate.getMonth() + 1}월 ${weekStartDate.getDate()}일 – ${weekEndDate.getMonth() + 1}월 ${weekEndDate.getDate()}일`
  const todayKeyStr = formatDateKey(new Date())

  const formatCommentTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header
        profile={profile as { nickname?: string; avatar_url?: string } | undefined}
        email={user?.email}
        onLogout={handleLogout}
        onProfileEdit={() => setShowProfileEdit(true)}
        onAccountsOpen={() => setShowAccountsModal(true)}
      />

      {showProfileEdit && (
        <Profile
          onClose={() => {
            setShowProfileEdit(false)
            loadProfile()
          }}
        />
      )}

      {showAccountsModal && (
        <AccountsModal onClose={() => setShowAccountsModal(false)} />
      )}

      {showWeeklyReport && (
        <WeeklyReportModal
          weekAnchor={weekAnchor}
          thisWeekTasks={tasks}
          nickname={(profile as { nickname?: string })?.nickname || ''}
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      <TaskModal
        open={taskModalOpen}
        mode={taskModalMode}
        defaultDate={selectedKey}
        registerCalendarDate={registerCalendarDateKey || formatDateKey(selectedDate)}
        task={editingTask}
        onClose={() => {
          setTaskModalOpen(false)
          setEditingTask(null)
        }}
        onSubmit={handleModalSubmit}
      />

      <div className="flex flex-col md:flex-row md:h-[calc(100vh-73px)]">
        <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200 p-4 md:p-8 overflow-y-auto">
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-[#f9f9f9] w-fit gap-0.5 mb-6">
            <button
              type="button"
              onClick={() => {
                setCalendarView('week')
                setWeekAnchor(new Date(selectedDate))
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                calendarView === 'week'
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              주간
            </button>
            <button
              type="button"
              onClick={() => {
                setCalendarView('month')
                setCurrentMonth(new Date(selectedDate))
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                calendarView === 'month'
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              월간
            </button>
          </div>

          {calendarView === 'month' ? (
            <>
              <div className="mb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-4xl md:text-6xl font-black text-gray-900 mb-4 md:mb-6">
                      {String(currentMonth.getMonth() + 1).padStart(2, '0')}
                    </div>
                    <div className="items-center gap-4">
                      <div className="text-2xl md:text-4xl font-black text-gray-900">{monthNames[currentMonth.getMonth()]}</div>
                      <div className="text-xl md:text-3xl font-bold mt-2 text-[#aaaaaa]">{currentMonth.getFullYear()}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="이전 달 (← 키)"
                      type="button"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      title="오늘로 이동"
                      type="button"
                    >
                      Today
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="다음 달 (→ 키)"
                      type="button"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {weekDays.map((day, index) => (
                    <div key={day} className="text-center">
                      <span
                        className={`text-lg font-bold ${
                          index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-[#aaaaaa]'
                        }`}
                      >
                        {day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const dayOfWeek = index % 7
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                    const holidayName = day ? getHolidayInfo(day) : null
                    const isHolidayDate = !!holidayName

                    const cellDate =
                      day !== null ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) : null
                    const cellKey = cellDate ? formatDateKey(cellDate) : ''
                    const taskCount = cellKey ? (tasksByDate[cellKey]?.length ?? 0) : 0
                    const hasJiraOnDay =
                      cellKey && (tasksByDate[cellKey] || []).some((t) => t.is_jira_linked)

                    return (
                      <div key={index} className="aspect-square">
                        {day !== null ? (
                          <button
                            type="button"
                            onClick={() => {
                              const newDate = new Date(currentMonth)
                              newDate.setDate(day)
                              setSelectedDate(newDate)
                            }}
                            title={holidayName || undefined}
                            className={`
                          w-full h-full rounded-lg flex items-start justify-end p-2
                          text-base font-bold transition-all relative
                          ${
                            isSelectedDate(day)
                              ? 'bg-[#FF6114] text-white shadow-md'
                              : isToday(day)
                                ? 'bg-[#f9f9f9] border-2 border-orange-500 text-gray-900 font-bold'
                                : 'bg-[#f9f9f9] text-[#aaaaaa] hover:bg-gray-50'
                          }
                          ${
                            (isWeekend || isHolidayDate) && !isSelectedDate(day) && !isToday(day)
                              ? 'text-red-500'
                              : ''
                          }
                        `}
                          >
                            {day}
                            {isHolidayDate && (
                              <span
                                className={`absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                                  isSelectedDate(day) ? 'bg-white' : 'bg-red-500'
                                }`}
                                title={holidayName}
                              />
                            )}
                            {taskCount > 0 && (
                              <span
                                className={`absolute bottom-1 left-1.5 text-[11px] font-bold leading-none ${
                                  isSelectedDate(day)
                                    ? 'text-white/90'
                                    : hasJiraOnDay
                                      ? 'text-orange-500'
                                      : 'text-[#FF6114]'
                                }`}
                                title={`일정 ${taskCount}건`}
                              >
                                {taskCount > 9 ? '9+' : taskCount}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="w-full h-full" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-[#f9f9f9] px-4 py-3 text-sm text-[#aaaaaa]">
                <span className="font-medium text-gray-600">단축키</span>
                <span className="mx-2">·</span>
                ← → 월 이동
                <span className="mx-2">·</span>
                Shift + ← → 날짜 이동
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#aaaaaa] uppercase tracking-wide mb-2">이번 주</p>
                    <h2 className="text-2xl font-black text-gray-900 leading-tight">{weekRangeLabel}</h2>
                    <p className="text-sm text-gray-500 mt-2">회의용으로 한 주 일정을 한눈에 볼 수 있어요.</p>
                  <button
                    type="button"
                    onClick={() => setShowWeeklyReport(true)}
                    className="mt-3 px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    📋 주간보고 정리하기
                  </button>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={goToPreviousWeek}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="이전 주 (←)"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={goThisWeek}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      이번 주
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeek}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="다음 주 (→)"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {weekDays.map((day, index) => (
                    <div key={day} className="text-center">
                      <span
                        className={`text-xs font-bold ${
                          index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-[#aaaaaa]'
                        }`}
                      >
                        {day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 items-stretch">
                  {weekDates.map((d, index) => {
                    const cellKey = formatDateKey(d)
                    const list = tasksByDate[cellKey] || []
                    const taskCount = list.length
                    const holidayName = holidays[cellKey]
                    const isHolidayDate = !!holidayName
                    const isSel = cellKey === selectedKey
                    const isTodayCell = cellKey === todayKeyStr
                    const isWeekend = index === 0 || index === 6
                    const hasJiraOnDay = list.some((t) => t.is_jira_linked)
                    const preview = list.slice(0, 3)

                    return (
                      <button
                        key={cellKey}
                        type="button"
                        onClick={() => setSelectedDate(new Date(d))}
                        title={holidayName || (taskCount ? `${taskCount}건` : undefined)}
                        className={`
                          min-h-[100px] md:min-h-[220px] rounded-lg p-1.5 md:p-2 text-left flex flex-col transition-all border-2
                          ${
                            isSel
                              ? 'bg-[#FF6114] text-white border-[#FF6114] shadow-md'
                              : isTodayCell
                                ? 'bg-[#f9f9f9] border-orange-500 text-gray-900'
                                : 'bg-[#f9f9f9] border-transparent text-gray-900 hover:bg-gray-50'
                          }
                          ${(isWeekend || isHolidayDate) && !isSel ? 'text-red-600' : ''}
                        `}
                      >
                        <div className="flex items-start justify-between gap-1 w-full">
                          <span className={`text-lg font-black tabular-nums ${isSel ? 'text-white' : ''}`}>
                            {d.getDate()}
                          </span>
                          {taskCount > 0 && (
                            <span
                              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isSel
                                  ? hasJiraOnDay
                                    ? 'bg-white text-orange-600'
                                    : 'bg-white/90 text-[#FF6114]'
                                  : hasJiraOnDay
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-[#FF6114] text-white'
                              }`}
                            >
                              {taskCount > 9 ? '9+' : taskCount}
                            </span>
                          )}
                        </div>
                        {holidayName && (
                          <p
                            className={`text-[10px] font-medium mt-1 line-clamp-2 ${isSel ? 'text-white/90' : 'text-red-600'}`}
                          >
                            {holidayName}
                          </p>
                        )}
                        <ul className="mt-2 flex-1 space-y-1 overflow-hidden w-full min-h-0">
                          {preview.map((t) => (
                            <li
                              key={t.id}
                              className={`text-[10px] leading-snug line-clamp-2 break-words ${
                                isSel ? 'text-white/95' : 'text-gray-600'
                              } ${t.is_completed ? 'line-through opacity-70' : ''}`}
                            >
                              {t.is_jira_linked && <span className="mr-0.5">🔗</span>}
                              {t.title}
                            </li>
                          ))}
                          {list.length > 3 && (
                            <li className={`text-[10px] font-medium ${isSel ? 'text-white/80' : 'text-orange-600'}`}>
                              +{list.length - 3}건
                            </li>
                          )}
                          {list.length === 0 && !holidayName && (
                            <li className={`text-[10px] ${isSel ? 'text-white/60' : 'text-gray-400'}`}>—</li>
                          )}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-[#f9f9f9] px-4 py-3 text-sm text-[#aaaaaa]">
                <span className="font-medium text-gray-600">단축키</span>
                <span className="mx-2">·</span>
                ← → 주 이동
                <span className="mx-2">·</span>
                Shift + ← → 날짜 이동
              </div>
            </>
          )}
        </div>

        <div className="w-full md:w-1/2 flex flex-col">
          <div className="border-b border-gray-200 px-4 py-4 md:px-8 md:py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-3xl md:text-5xl font-bold text-gray-900">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][selectedDate.getDay()]}
                  </span>
                  <span className="text-red-500 text-xl md:text-2xl">•</span>
                </div>
                <span className="text-3xl md:text-5xl font-black text-gray-900">{selectedDate.getDate()}</span>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="shrink-0 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                일정 추가
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            {taskLoadError && (
              <div className="mb-4 px-4 py-3 rounded-md text-sm bg-red-50 text-red-700 border border-red-200">
                {taskLoadError}
              </div>
            )}

            {/* 담당자 필터 */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterAssignee(null)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  filterAssignee === null ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                전체
              </button>
              {['고진석', '김아름', '조소영', '김영은'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFilterAssignee(filterAssignee === name ? null : name)}
                  className={`flex items-center gap-1.5 pl-1 pr-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    filterAssignee === name ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {avatarByNickname[name] ? (
                    <img src={avatarByNickname[name]} alt={name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center">{name[0]}</span>
                  )}
                  {name}
                </button>
              ))}
            </div>

            <div className="space-y-4 mb-8">
              {holidays[selectedKey] && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 hover:bg-blue-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 text-sm font-semibold">공휴일</span>
                    <span className="text-gray-400">•</span>
                    <h3 className="text-sm font-semibold text-gray-900">{holidays[selectedKey]}</h3>
                  </div>
                </div>
              )}

              {dayTasks.length === 0 && !holidays[selectedKey] && (
                <p className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-lg">
                  이 날짜에 등록된 일정이 없습니다.
                  <br />
                  <button type="button" onClick={openCreateModal} className="mt-2 text-orange-600 font-medium hover:underline">
                    일정 추가
                  </button>
                </p>
              )}

              {dayTasks.map((task) => {
                const isSel = task.id === selectedTaskId
                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTaskId(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedTaskId(task.id)
                      }
                    }}
                    className={`border rounded-lg p-4 transition-shadow text-left cursor-pointer ${
                      isSel ? 'border-orange-500 ring-2 ring-orange-200 shadow-md' : 'border-gray-200 hover:shadow-md'
                    }`}
                  >
                    {/* 상단: 제목 + 담당자 아이콘 + 수정/삭제 */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <h3 className={`text-base font-semibold break-words ${task.date && task.date < formatDateKey(new Date()) ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.is_event && (
                            <span className="font-bold mr-1">[EVENT]</span>
                          )}
                          {task.title}
                        </h3>
                        {/* 담당자 아이콘 (겹치기) */}
                        {task.assignee?.trim() && (
                          <div className="flex items-center shrink-0" style={{ marginTop: -2 }}>
                            {task.assignee.split(',').map((name) => name.trim()).filter(Boolean).map((name, i) => (
                              avatarByNickname[name] ? (
                                <img
                                  key={i}
                                  src={avatarByNickname[name]}
                                  alt={name}
                                  title={name}
                                  style={{ zIndex: i }}
                                  className="w-8 h-8 rounded-full object-cover border-2 border-white shrink-0 -ml-2 first:ml-0"
                                />
                              ) : (
                                <span
                                  key={i}
                                  title={name}
                                  style={{ zIndex: i }}
                                  className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center shrink-0 border-2 border-white -ml-2 first:ml-0"
                                >
                                  {name[0]}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            className="p-1.5 text-gray-400 hover:text-orange-600 rounded-md hover:bg-gray-50"
                            title="수정"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-50"
                            title="삭제"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                    </div>

                    {task.content && <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{task.content}</p>}

                    {/* 하단: 배지 + 날짜 우측 정렬 */}
                    <div className="flex items-end justify-between gap-2" style={{ marginTop: 10 }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {task.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            task.status === '개발완료' ? 'bg-green-100 text-green-700'
                            : task.status === '개발중' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {task.status}
                          </span>
                        )}
                        {task.dev_type && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            task.dev_type === '일상' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {task.dev_type}
                          </span>
                        )}
                      </div>

                      {/* 날짜 정보 우측 하단 */}
                      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-xs text-gray-400 shrink-0">
                        <span>작성: {authorByUserId[task.created_by]?.trim() || '—'}</span>
                        <span>|</span>
                        {task.date && <><span>배포 {task.date}</span><span>|</span></>}
                        <span>등록 {task.registered_date ?? formatDateKey(new Date(task.created_at))}</span>
                        {task.is_jira_linked && (
                          <>
                            <span>|</span>
                            <span className="text-orange-500 font-medium">Jira</span>
                          </>
                        )}
                      </div>
                    </div>

                    {(task.jira_ticket_url || task.jira_ticket_id) && (
                      <div className="pl-7 mt-1.5">
                        {task.jira_ticket_url ? (
                          <a
                            href={task.jira_ticket_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            🔗 티켓 링크
                          </a>
                        ) : (
                          <span className="text-sm text-blue-600">🔗 {task.jira_ticket_id}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">댓글</h4>
              {!selectedTask ? (
                <p className="text-sm text-gray-500 py-4">일정을 선택하면 댓글을 작성할 수 있습니다.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-1">「{selectedTask.title}」</p>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {(profile as { nickname?: string } | null)?.nickname?.[0]?.toUpperCase() || '나'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="댓글을 입력하세요…"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-white"
                        rows={3}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handlePostComment}
                          disabled={commentSubmitting || !commentText.trim()}
                          className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                        >
                          {commentSubmitting ? '등록 중…' : '등록'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {comments.length === 0 && (
                      <p className="text-sm text-gray-400">아직 댓글이 없습니다.</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 flex items-center justify-center text-xs font-medium text-gray-600">
                          {c.nickname[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{c.nickname}</span>
                            <span className="text-xs text-gray-400">{formatCommentTime(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
