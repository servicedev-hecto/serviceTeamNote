// 이메일 검증 함수들

export function validateHectoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@hecto.co.kr')
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function getEmailError(email: string): string | null {
  if (!email || email.trim() === '') {
    return '이메일을 입력해주세요'
  }
  
  if (!isValidEmail(email)) {
    return '올바른 이메일 형식이 아닙니다'
  }
  
  if (!validateHectoEmail(email)) {
    return 'hecto.co.kr 이메일만 가입 가능합니다'
  }
  
  return null
}

export function getPasswordError(password: string): string | null {
  if (!password || password.trim() === '') {
    return '비밀번호를 입력해주세요'
  }
  
  if (password.length < 6) {
    return '비밀번호는 최소 6자 이상이어야 합니다'
  }
  
  return null
}

export function validateLoginForm(email: string, password: string): {
  isValid: boolean
  emailError?: string
  passwordError?: string
} {
  const emailError = getEmailError(email)
  const passwordError = getPasswordError(password)
  
  return {
    isValid: !emailError && !passwordError,
    emailError: emailError || undefined,
    passwordError: passwordError || undefined,
  }
}
