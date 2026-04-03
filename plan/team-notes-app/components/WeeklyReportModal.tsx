'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/types/database.types'

interface Props {
  weekAnchor: Date
  thisWeekTasks: Task[]
  nickname: string
  onClose: () => void
}

function formatKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWeekBounds(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  start.setDate(start.getDate() - start.getDay()) // Sunday
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Saturday
  return { start, end }
}

/** 주차 계산: 해당 주의 목요일 기준 */
function getWeekInfo(weekStart: Date): { month: number; week: number; year: number } {
  const thursday = new Date(weekStart)
  thursday.setDate(thursday.getDate() + 4)
  return {
    year: thursday.getFullYear(),
    month: thursday.getMonth() + 1,
    week: Math.ceil(thursday.getDate() / 7),
  }
}

function formatDateMD(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}.${m}.${d}`
}

export default function WeeklyReportModal({ weekAnchor, thisWeekTasks, nickname, onClose }: Props) {
  const supabase = createClient()
  const [nextWeekTasks, setNextWeekTasks] = useState<Task[]>([])
  const [eventTasks, setEventTasks] = useState<Task[]>([])
  const [copied, setCopied] = useState(false)

  const { start: weekStart, end: weekEnd } = getWeekBounds(weekAnchor)
  const { month: reportMonth, week: weekNum, year: reportYear } = getWeekInfo(weekStart)

  const nextWeekStart = new Date(weekEnd)
  nextWeekStart.setDate(nextWeekStart.getDate() + 1)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6)

  const eventRangeEnd = new Date(weekStart)
  eventRangeEnd.setDate(eventRangeEnd.getDate() + 42) // 6주

  // 금주 태스크: 배포일이 이번 주, 일상 제외
  const thisWeekFiltered = thisWeekTasks
    .filter((t) => t.date >= formatKey(weekStart) && t.date <= formatKey(weekEnd) && t.dev_type !== '일상')
    .sort((a, b) => a.date.localeCompare(b.date))

  useEffect(() => {
    const fetchData = async () => {
      const { data: nw } = await supabase
        .from('tasks')
        .select('*')
        .gte('date', formatKey(nextWeekStart))
        .lte('date', formatKey(nextWeekEnd))
        .neq('dev_type', '일상')
        .order('date', { ascending: true })
      setNextWeekTasks((nw as Task[]) || [])

      const { data: ev } = await supabase
        .from('tasks')
        .select('*')
        .gt('date', formatKey(weekEnd))
        .lte('date', formatKey(eventRangeEnd))
        .eq('is_event', true)
        .order('date', { ascending: true })
      setEventTasks((ev as Task[]) || [])
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const thStyle = 'background:#4472C4;color:white;border:1px solid #ccc;padding:6px 10px;text-align:center;font-size:12px;white-space:nowrap;'

  const generateHTML = (): string => {
    const tableStyle = 'border-collapse:collapse;width:1000px;margin-bottom:16px;'

    const td = (extra = '', gray = false) =>
      `border:1px solid #ccc;padding:6px 10px;font-size:12px;${extra}${gray ? 'background:#d0d0d0;color:#777;' : ''}`

    const thisWeekRows = thisWeekFiltered.map((t) => {
      const g = t.is_completed
      return `<tr>
        <td style="${td('', g)}">${t.title}</td>
        <td style="${td('text-align:center;', g)}">${formatDateMD(t.date)}</td>
        <td style="${td('text-align:center;', g)}">${t.assignee || ''}</td>
      </tr>`
    }).join('')

    const nextWeekRows = nextWeekTasks.map((t) => {
      const g = t.is_completed
      return `<tr>
        <td style="${td('', g)}">${t.title}</td>
        <td style="${td('text-align:center;', g)}">${t.assignee || ''}</td>
      </tr>`
    }).join('')

    const eventRows = eventTasks.map((t, i) => {
      const g = t.is_completed
      return `<tr>
        <td style="${td('text-align:center;', g)}">${i + 1}</td>
        <td style="${td('', g)}">${t.title}</td>
        <td style="${td('text-align:center;', g)}">${formatDateFull(t.date)}</td>
        <td style="${td('text-align:center;', g)}">${(t as Task & { has_page?: boolean }).has_page ? '○' : ''}</td>
        <td style="${td('text-align:center;', g)}">${t.dev_type?.includes('개발') ? '○' : ''}</td>
      </tr>`
    }).join('')

    return `
<p>안녕하세요 실장님<br>${nickname}입니다.</p>
<p>서비스개발팀 주간보고 송부드립니다.</p>
<p><b>[API 대기 업무]</b><br>- 없음</p>
<p><b>[금주업무]</b>&nbsp; 회색 : 배포완료</p>
${thisWeekFiltered.length === 0
  ? '<p>- 없음</p>'
  : `<table style="${tableStyle}"><thead><tr>
      <th style="${thStyle}text-align:left;">내용</th>
      <th style="${thStyle}">배포(예정)일</th>
      <th style="${thStyle}">담당자</th>
    </tr></thead><tbody>${thisWeekRows}</tbody></table>`}
<p><b>[차주업무]</b></p>
${nextWeekTasks.length === 0
  ? '<p>- 없음</p>'
  : `<table style="${tableStyle}"><thead><tr>
      <th style="${thStyle}text-align:left;">내용</th>
      <th style="${thStyle}">담당자</th>
    </tr></thead><tbody>${nextWeekRows}</tbody></table>`}
<p><b>[이벤트]</b>&nbsp; 회색 : 배포완료</p>
${eventTasks.length === 0
  ? '<p>- 없음</p>'
  : `<table style="${tableStyle}"><thead><tr>
      <th style="${thStyle}">No</th>
      <th style="${thStyle}text-align:left;">이벤트명</th>
      <th style="${thStyle}">개시일</th>
      <th style="${thStyle}">페이지 유무</th>
      <th style="${thStyle}">개발 필요 여부</th>
    </tr></thead><tbody>${eventRows}</tbody></table>`}
<p>이상입니다.</p>`
  }

  const handleCopy = async () => {
    try {
      const html = generateHTML()
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
        }),
      ])
    } catch {
      // fallback: 일부 브라우저에서 ClipboardItem 미지원 시
      const plain = generateHTML().replace(/<[^>]+>/g, '')
      await navigator.clipboard.writeText(plain)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            [서비스개발팀] {reportMonth}월 {weekNum}주차 주간보고
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {copied ? '복사됨 ✓' : '텍스트 복사'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm">
          {/* 인사 */}
          <div className="text-gray-700 leading-relaxed">
            <p>안녕하세요 실장님</p>
            <p>{nickname}입니다.</p>
            <br />
            <p>서비스개발팀 주간보고 송부드립니다.</p>
          </div>

          {/* API 대기 업무 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2">[API 대기 업무]</h3>
            <p className="text-gray-500">- 없음</p>
          </div>

          {/* 금주업무 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-gray-900">[금주업무]</h3>
              <span className="text-xs text-gray-400">회색 : 배포완료</span>
            </div>
            {thisWeekFiltered.length === 0 ? (
              <p className="text-gray-400">- 없음</p>
            ) : (
              <table className="w-full border-collapse text-xs" style={{ minWidth: '600px' }}>
                <thead>
                  <tr className="bg-[#4472C4] text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">내용</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">배포(예정)일</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-28">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {thisWeekFiltered.map((t) => (
                    <tr
                      key={t.id}
                      className={t.is_completed ? 'bg-gray-200 text-gray-500' : 'bg-white'}
                    >
                      <td className="border border-gray-300 px-3 py-2">{t.title}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{formatDateMD(t.date)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{t.assignee || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 차주업무 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-2">[차주업무]</h3>
            {nextWeekTasks.length === 0 ? (
              <p className="text-gray-400">- 없음</p>
            ) : (
              <table className="w-full border-collapse text-xs" style={{ minWidth: '600px' }}>
                <thead>
                  <tr className="bg-[#4472C4] text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">내용</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-28">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {nextWeekTasks.map((t) => (
                    <tr key={t.id} className={t.is_completed ? 'bg-gray-200 text-gray-500' : 'bg-white'}>
                      <td className="border border-gray-300 px-3 py-2">{t.title}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{t.assignee || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 이벤트 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-gray-900">[이벤트]</h3>
              <span className="text-xs text-gray-400">회색 : 배포완료</span>
            </div>
            {eventTasks.length === 0 ? (
              <p className="text-gray-400">- 없음</p>
            ) : (
              <table className="w-full border-collapse text-xs" style={{ minWidth: '600px' }}>
                <thead>
                  <tr className="bg-[#4472C4] text-white">
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-8">No</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">이벤트명</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">개시일</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-20">페이지 유무</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-semibold w-24">개발 필요 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {eventTasks.map((t, i) => (
                    <tr key={t.id} className={t.is_completed ? 'bg-gray-200 text-gray-500' : 'bg-white'}>
                      <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-300 px-3 py-2">{t.title}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{formatDateFull(t.date)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        {(t as Task & { has_page?: boolean }).has_page ? '○' : ''}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        {t.dev_type?.includes('개발') ? '○' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-gray-700">이상입니다.</p>
        </div>
      </div>
    </div>
  )
}
