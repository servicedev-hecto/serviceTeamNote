'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { validateLoginForm, getEmailError, getPasswordError } from '@/lib/validation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [showPassword, setShowPassword] = useState(false)

  // 비밀번호 찾기 모달 상태
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotEmailError, setForgotEmailError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // URL 해시 또는 쿼리 파라미터에서 Supabase 에러 감지
  useEffect(() => {
    if (typeof window === 'undefined') return

    const getErrorMessage = (error: string | null, errorCode: string | null): string | null => {
      if (!error && !errorCode) return null
      if (errorCode === 'otp_expired') return '비밀번호 재설정 링크가 만료되었습니다. 다시 요청해주세요.'
      if (error === 'access_denied') return '링크가 만료되었거나 이미 사용된 링크입니다.'
      if (error === 'auth_callback_failed') return '인증에 실패했습니다. 다시 시도해주세요.'
      return '링크가 유효하지 않습니다'
    }

    // 쿼리 파라미터 확인
    const searchParams = new URLSearchParams(window.location.search)
    const qError = searchParams.get('error') || searchParams.get('error_code')
    const qErrorCode = searchParams.get('error_code')

    // 해시 파라미터 확인
    const hash = window.location.hash
    const hashParams = hash ? new URLSearchParams(hash.replace('#', '')) : null
    const hError = hashParams?.get('error') ?? null
    const hErrorCode = hashParams?.get('error_code') ?? null

    const errorMessage = getErrorMessage(qError, qErrorCode) || getErrorMessage(hError, hErrorCode)

    if (errorMessage) {
      setMessage({ type: 'error', text: errorMessage })
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleForgotEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setForgotEmail(value)
    if (forgotEmailError) {
      const error = getEmailError(value)
      setForgotEmailError(error || '')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotMessage(null)

    const error = getEmailError(forgotEmail)
    if (error) {
      setForgotEmailError(error)
      return
    }
    setForgotEmailError('')
    setForgotLoading(true)

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        {
          redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
        }
      )

      if (resetError) {
        console.error('resetPasswordForEmail error:', resetError.message)
        let errorText = '비밀번호 재설정 메일 발송에 실패했습니다'
        if (resetError.message.toLowerCase().includes('rate limit') || resetError.status === 429) {
          errorText = '이메일 발송 횟수 초과입니다. 잠시 후 다시 시도해주세요.'
        }
        setForgotMessage({ type: 'error', text: errorText })
      } else {
        setForgotMessage({
          type: 'success',
          text: '비밀번호 재설정 링크를 이메일로 발송했습니다. 받은 메일함을 확인해주세요.',
        })
        setForgotEmail('')
      }
    } catch {
      setForgotMessage({ type: 'error', text: '오류가 발생했습니다. 다시 시도해주세요.' })
    } finally {
      setForgotLoading(false)
    }
  }

  const handleCloseForgotModal = () => {
    setShowForgotModal(false)
    setForgotEmail('')
    setForgotEmailError('')
    setForgotMessage(null)
  }

  // 이메일 변경 핸들러
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    
    // 터치된 후에만 에러 표시
    if (touched.email) {
      const error = getEmailError(value)
      setEmailError(error || '')
    }
  }

  // 비밀번호 변경 핸들러
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    
    if (touched.password) {
      const error = getPasswordError(value)
      setPasswordError(error || '')
    }
  }

  // 필드 포커스 아웃 핸들러
  const handleEmailBlur = () => {
    setTouched({ ...touched, email: true })
    const error = getEmailError(email)
    setEmailError(error || '')
  }

  const handlePasswordBlur = () => {
    setTouched({ ...touched, password: true })
    const error = getPasswordError(password)
    setPasswordError(error || '')
  }

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    // 모든 필드를 터치된 것으로 표시
    setTouched({ email: true, password: true })
    
    // 유효성 검증
    const validation = validateLoginForm(email, password)
    
    if (!validation.isValid) {
      setEmailError(validation.emailError || '')
      setPasswordError(validation.passwordError || '')
      return
    }
    
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        // Supabase 에러 메시지를 한글로 변환
        let errorMessage = '로그인에 실패했습니다'
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다'
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = '이메일 인증이 필요합니다. 받은 메일함을 확인해주세요'
        } else if (error.message.includes('User not found')) {
          errorMessage = '등록되지 않은 이메일입니다'
        }
        
        setMessage({ type: 'error', text: errorMessage })
      } else {
        setMessage({ type: 'success', text: '로그인 성공!' })
        setTimeout(() => {
          router.push('/month')
        }, 500)
      }
    } catch (err) {
      setMessage({ type: 'error', text: '로그인 중 오류가 발생했습니다' })
    } finally {
      setLoading(false)
    }
  }

  // 회원가입 처리
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    
    // 모든 필드를 터치된 것으로 표시
    setTouched({ email: true, password: true })
    
    // 유효성 검증
    const validation = validateLoginForm(email, password)
    
    if (!validation.isValid) {
      setEmailError(validation.emailError || '')
      setPasswordError(validation.passwordError || '')
      return
    }
    
    setLoading(true)

    try {
      const { error, data } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/month`,
        }
      })

      if (error) {
        let errorMessage = '회원가입에 실패했습니다'
        
        if (error.message.includes('User already registered')) {
          errorMessage = '이미 가입된 이메일입니다'
        } else if (error.message.includes('Password should be at least 6 characters')) {
          errorMessage = '비밀번호는 최소 6자 이상이어야 합니다'
        }
        
        setMessage({ type: 'error', text: errorMessage })
      } else {
        if (data?.user?.identities?.length === 0) {
          setMessage({ 
            type: 'error', 
            text: '이미 가입된 이메일입니다. 로그인해주세요.' 
          })
        } else {
          setMessage({ 
            type: 'success', 
            text: '회원가입 완료! 이메일 인증 후 로그인해주세요.' 
          })
          // 입력 필드 초기화
          setEmail('')
          setPassword('')
          setTouched({ email: false, password: false })
          setEmailError('')
          setPasswordError('')
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: '회원가입 중 오류가 발생했습니다' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-20 items-center">
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

        {/* 오른쪽: 로그인 폼 */}
        <div className="w-full max-w-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 이메일 입력 */}
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                className={`
                  w-full px-4 py-3.5 bg-gray-100 border-0 rounded-md
                  focus:outline-none focus:ring-2 text-gray-900 text-base
                  placeholder-gray-500 transition-all
                  ${emailError 
                    ? 'ring-2 ring-red-500 focus:ring-red-500' 
                    : 'focus:ring-orange-500'
                  }
                `}
                placeholder="이메일 입력 (예: name@hecto.co.kr)"
              />
              {emailError && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {emailError}
                </p>
              )}
            </div>
            
            {/* 비밀번호 입력 */}
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className={`
                    w-full pl-4 pr-12 py-3.5 bg-gray-100 border-0 rounded-md
                    focus:outline-none focus:ring-2 text-gray-900 text-base
                    placeholder-gray-500 transition-all
                    ${passwordError 
                      ? 'ring-2 ring-red-500 focus:ring-red-500' 
                      : 'focus:ring-orange-500'
                    }
                  `}
                  placeholder="비밀번호 입력 (최소 6자)"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {passwordError}
                </p>
              )}
            </div>

            {/* 전역 메시지 표시 */}
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

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
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
                '로그인'
              )}
            </button>
            
            {/* 회원가입 버튼 */}
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gray-300 hover:bg-gray-400
                       text-gray-700 font-medium text-base rounded-md
                       focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            >
              {loading ? '처리 중...' : '회원가입'}
            </button>

            {/* 비밀번호 찾기 링크 */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-sm text-gray-500 hover:text-orange-500 transition-colors duration-200 underline-offset-2 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 비밀번호 찾기 모달 */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseForgotModal() }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">비밀번호 재설정</h2>
              <button
                type="button"
                onClick={handleCloseForgotModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={handleForgotEmailChange}
                  onBlur={() => {
                    const error = getEmailError(forgotEmail)
                    setForgotEmailError(error || '')
                  }}
                  placeholder="이메일 입력 (예: name@hecto.co.kr)"
                  className={`
                    w-full px-4 py-3.5 bg-gray-100 border-0 rounded-md
                    focus:outline-none focus:ring-2 text-gray-900 text-base
                    placeholder-gray-500 transition-all
                    ${forgotEmailError
                      ? 'ring-2 ring-red-500 focus:ring-red-500'
                      : 'focus:ring-orange-500'
                    }
                  `}
                />
                {forgotEmailError && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {forgotEmailError}
                  </p>
                )}
              </div>

              {forgotMessage && (
                <div className={`
                  px-4 py-3 rounded-md text-sm flex items-start gap-2
                  ${forgotMessage.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                  }
                `}>
                  {forgotMessage.type === 'error' ? (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{forgotMessage.text}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCloseForgotModal}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300
                           text-gray-700 font-medium text-base rounded-md
                           focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                           transition-all duration-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600
                           text-white font-medium text-base rounded-md
                           focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {forgotLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>발송 중...</span>
                    </>
                  ) : (
                    '재설정 메일 발송'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
