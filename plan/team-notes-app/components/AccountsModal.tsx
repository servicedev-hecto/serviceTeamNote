'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const ACCOUNTS_PASSWORD = 'service11!!'

interface TeamAccount {
  id: string
  service_name: string
  account_id: string
  account_password: string
  url: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

interface AccountsModalProps {
  onClose: () => void
}

export default function AccountsModal({ onClose }: AccountsModalProps) {
  const supabase = createClient()

  // 비밀번호 인증 상태
  const [authenticated, setAuthenticated] = useState(false)
  const [inputPassword, setInputPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // 계정 목록
  const [accounts, setAccounts] = useState<TeamAccount[]>([])
  const [loading, setLoading] = useState(false)

  // 추가/수정 폼
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    service_name: '',
    account_id: '',
    account_password: '',
    url: '',
    memo: '',
  })
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // 비밀번호 표시 토글 (목록)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  // 삭제 확인
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputPassword === ACCOUNTS_PASSWORD) {
      setAuthenticated(true)
      fetchAccounts()
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.')
    }
  }

  const fetchAccounts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('team_accounts')
      .select('*')
      .order('service_name', { ascending: true })
    if (!error && data) setAccounts(data)
    setLoading(false)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.service_name.trim() || !form.account_id.trim() || !form.account_password.trim()) {
      setFormError('서비스명, 아이디, 비밀번호는 필수입니다.')
      return
    }
    setSaving(true)
    const payload = {
      service_name: form.service_name.trim(),
      account_id: form.account_id.trim(),
      account_password: form.account_password.trim(),
      url: form.url.trim() || null,
      memo: form.memo.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('team_accounts').update(payload).eq('id', editingId)
      if (error) { setFormError('수정 중 오류가 발생했습니다.'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('team_accounts').insert(payload)
      if (error) { setFormError('저장 중 오류가 발생했습니다.'); setSaving(false); return }
    }

    setSaving(false)
    resetForm()
    fetchAccounts()
  }

  const handleEdit = (account: TeamAccount) => {
    setEditingId(account.id)
    setForm({
      service_name: account.service_name,
      account_id: account.account_id,
      account_password: account.account_password,
      url: account.url || '',
      memo: account.memo || '',
    })
    setShowForm(true)
    setFormError('')
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('team_accounts').delete().eq('id', id)
    if (!error) {
      setDeletingId(null)
      fetchAccounts()
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ service_name: '', account_id: '', account_password: '', url: '', memo: '' })
    setShowFormPassword(false)
    setFormError('')
  }

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔐</span>
            <h2 className="text-lg font-semibold text-gray-900">팀 계정 모음</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 비밀번호 인증 */}
        {!authenticated ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 gap-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🔑</span>
            </div>
            <p className="text-gray-600 text-sm">계정 정보를 보려면 팀 비밀번호를 입력하세요.</p>
            <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs flex flex-col gap-3">
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => { setInputPassword(e.target.value); setPasswordError('') }}
                placeholder="팀 비밀번호 입력"
                autoFocus
                className={`w-full px-4 py-3 bg-gray-100 rounded-lg text-gray-900 focus:outline-none focus:ring-2 ${passwordError ? 'ring-2 ring-red-400' : 'focus:ring-orange-500'}`}
              />
              {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
              >
                확인
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* 계정 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  저장된 계정이 없습니다. 아래 버튼으로 추가해주세요.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="border border-gray-100 rounded-xl p-4 hover:border-orange-200 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* 서비스명 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">{account.service_name}</span>
                            {account.url && (
                              <a href={account.url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                          {/* 아이디 */}
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <span className="text-gray-400 w-14 shrink-0">아이디</span>
                            <span className="font-mono">{account.account_id}</span>
                            <button onClick={() => copyToClipboard(account.account_id)} className="text-gray-300 hover:text-orange-500 transition-colors" title="복사">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          {/* 비밀번호 */}
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <span className="text-gray-400 w-14 shrink-0">비밀번호</span>
                            <span className="font-mono">
                              {visiblePasswords.has(account.id) ? account.account_password : '••••••••'}
                            </span>
                            <button onClick={() => togglePasswordVisibility(account.id)} className="text-gray-300 hover:text-orange-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {visiblePasswords.has(account.id)
                                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                                }
                              </svg>
                            </button>
                            <button onClick={() => copyToClipboard(account.account_password)} className="text-gray-300 hover:text-orange-500 transition-colors" title="복사">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          {/* 메모 */}
                          {account.memo && (
                            <div className="text-xs text-gray-400 mt-1">{account.memo}</div>
                          )}
                        </div>
                        {/* 수정/삭제 버튼 */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleEdit(account)}
                            className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                            title="수정"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deletingId === account.id ? (
                            <div className="flex gap-1 items-center">
                              <button onClick={() => handleDelete(account.id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded">삭제</button>
                              <button onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">취소</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(account.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 추가/수정 폼 */}
              {showForm && (
                <div className="mt-4 border border-orange-200 rounded-xl p-4 bg-orange-50">
                  <h3 className="font-semibold text-gray-900 mb-3">{editingId ? '계정 수정' : '새 계정 추가'}</h3>
                  <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="서비스명 *"
                      value={form.service_name}
                      onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="아이디 *"
                      value={form.account_id}
                      onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="relative">
                      <input
                        type={showFormPassword ? 'text' : 'password'}
                        placeholder="비밀번호 *"
                        value={form.account_password}
                        onChange={(e) => setForm({ ...form, account_password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button type="button" onClick={() => setShowFormPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {showFormPassword
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                          }
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="URL (선택)"
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <textarea
                      placeholder="메모 (선택)"
                      value={form.memo}
                      onChange={(e) => setForm({ ...form, memo: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                    {formError && <p className="text-red-500 text-sm">{formError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : editingId ? '수정 완료' : '추가'}
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            {!showForm && (
              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  계정 추가
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
