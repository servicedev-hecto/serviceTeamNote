'use client'

import Image from 'next/image'
import { useState } from 'react'

interface HeaderProps {
  profile?: {
    nickname?: string
    avatar_url?: string
  }
  email?: string
  onLogout: () => void
  onProfileEdit?: () => void
  onAccountsOpen?: () => void
}

// 프로필 첫 글자 가져오기 (닉네임 우선, 없으면 이메일)
function getProfileInitial(nickname: string | null | undefined, email: string | undefined): string {
  if (nickname && nickname.trim()) {
    return nickname.trim()[0].toUpperCase()
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return 'U'
}

export default function Header({ profile, email, onLogout, onProfileEdit, onAccountsOpen }: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <Image
            src="/sub-logo.png"
            alt="Hecto Healthcare Service Team Note"
            width={250}
            height={70}
            priority
            className="h-10 w-auto"
          />
        </div>

        {/* 팀 계정 버튼 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAccountsOpen?.()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
            title="팀 계정 모음"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="hidden sm:inline">팀 계정</span>
          </button>

        {/* 프로필 */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-full px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {getProfileInitial(profile?.nickname, email)}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {profile?.nickname || 'User'}
            </span>
          </button>

          {/* 프로필 드롭다운 */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <button
                onClick={() => {
                  setShowProfileMenu(false)
                  onProfileEdit?.()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                프로필 편집
              </button>
              <hr className="my-2 border-gray-200" />
              <button
                onClick={() => {
                  setShowProfileMenu(false)
                  onLogout()
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
