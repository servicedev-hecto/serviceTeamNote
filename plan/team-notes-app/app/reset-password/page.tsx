'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '' }
  if (password.length < 6) return { level: 1, label: '약함', color: 'bg-red-400' }
  if (password.length < 10) return { level: 2, label: '보통', color: 'bg-yellow-400' }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (score >= 3) return { level: 3, label: '강함', color: 'bg-green-500' }
  return { level: 2, label: '보통', color: 'bg-yellow-400' }
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const strength = getPasswordStrength(password)

  useEffect(() => {
    // onAuthStateChange는 구독 즉시 현재 세션 상태를 발생시킴
    // INITIAL_SESSION: 쿠키 세션 복원 (서버사이드 코드 교환 후)
    // PASSWORD_RECOVERY: Implicit 플로우 해시 토큰
    // SIGNED_IN: 그 외 로그인 상태
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (
        event === 'INITIAL_SESSION' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN'
      )) {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const validatePassword = (value: string): string => {
    if (!value) return '새 비밀번호를 입력해주세요'
    if (value.length < 6) return '비밀번호는 최소 6자 이상이어야 합니다'
    return ''
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (passwordError) setPasswordError(validatePassword(value))
    if (confirmPassword && confirmError) {
      setConfirmError(value !== confirmPassword ? '비밀번호가 일치하지 않습니다' : '')
    }
  }

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setConfirmPassword(value)
    if (confirmError) {
      setConfirmError(password !== value ? '비밀번호가 일치하지 않습니다' : '')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const pwError = validatePassword(password)
    const cfError = password !== confirmPassword ? '비밀번호가 일치하지 않습니다' : ''

    setPasswordError(pwError)
    setConfirmError(cfError)

    if (pwError || cfError) return

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        let errorMessage = '비밀번호 변경에 실패했습니다'
        if (error.message.includes('same password')) {
          errorMessage = '현재 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요'
        } else if (error.message.includes('Auth session missing')) {
          errorMessage = '세션이 만료되었습니다. 비밀번호 재설정 메일을 다시 요청해주세요'
        }
        setMessage({ type: 'error', text: errorMessage })
      } else {
        setMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다!' })
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch {
      setMessage({ type: 'error', text: '오류가 발생했습니다. 다시 시도해주세요.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-50 items-center">
        {/* 왼쪽: 로고 */}
        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-md">
            <Image
              src="/logo_1.png"
              alt="Hecto Healthcare Service Team Note"
              width={400}
              height={400}
              priority
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* 오른쪽: 비밀번호 재설정 폼 */}
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">새 비밀번호 설정</h1>
            <p className="text-sm text-gray-500">새로 사용할 비밀번호를 입력해주세요</p>
          </div>

          {!sessionReady && (
            <div className="mb-4 px-4 py-3 rounded-md text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>이메일의 재설정 링크를 통해 접속해주세요. 세션을 확인 중입니다...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 새 비밀번호 */}
            <div>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={() => setPasswordError(validatePassword(password))}
                placeholder="새 비밀번호 (최소 6자)"
                disabled={!sessionReady}
                className={`
                  w-full px-4 py-3.5 bg-gray-100 border-0 rounded-md
                  focus:outline-none focus:ring-2 text-gray-900 text-base
                  placeholder-gray-500 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${passwordError
                    ? 'ring-2 ring-red-500 focus:ring-red-500'
                    : 'focus:ring-orange-500'
                  }
                `}
              />
              {/* 비밀번호 강도 표시 */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          strength.level >= i ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className="text-xs text-gray-500">
                      비밀번호 강도: <span className={`font-medium ${
                        strength.level === 1 ? 'text-red-500' :
                        strength.level === 2 ? 'text-yellow-500' : 'text-green-600'
                      }`}>{strength.label}</span>
                    </p>
                  )}
                </div>
              )}
              {passwordError && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {passwordError}
                </p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <input
                type="password"
                value={confirmPassword}
                onChange={handleConfirmChange}
                onBlur={() => setConfirmError(password !== confirmPassword ? '비밀번호가 일치하지 않습니다' : '')}
                placeholder="새 비밀번호 확인"
                disabled={!sessionReady}
                className={`
                  w-full px-4 py-3.5 bg-gray-100 border-0 rounded-md
                  focus:outline-none focus:ring-2 text-gray-900 text-base
                  placeholder-gray-500 transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${confirmError
                    ? 'ring-2 ring-red-500 focus:ring-red-500'
                    : confirmPassword && !confirmError
                      ? 'ring-2 ring-green-400'
                      : 'focus:ring-orange-500'
                  }
                `}
              />
              {confirmError && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {confirmError}
                </p>
              )}
              {confirmPassword && !confirmError && (
                <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  비밀번호가 일치합니다
                </p>
              )}
            </div>

            {/* 메시지 표시 */}
            {message && (
              <div className={`
                px-4 py-3 rounded-md text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300
                ${message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
                }
              `}>
                {message.type === 'error' ? (
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* 변경 버튼 */}
            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600
                       text-white font-medium text-base rounded-md
                       focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>처리 중...</span>
                </>
              ) : (
                '비밀번호 변경'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm text-gray-500 hover:text-orange-500 transition-colors duration-200 underline-offset-2 hover:underline"
              >
                로그인 페이지로 돌아가기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
