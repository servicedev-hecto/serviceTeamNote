'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ProfileProps {
  onClose: () => void
}

// 프로필 첫 글자 가져오기 (닉네임 우선, 없으면 이메일)
function getProfileInitial(nickname: string | null, email: string): string {
  if (nickname && nickname.trim()) {
    return nickname.trim()[0].toUpperCase()
  }
  return email[0].toUpperCase()
}

export default function Profile({ onClose }: ProfileProps) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUser(user)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      setNickname(profileData.nickname || '')
      setAvatarUrl(profileData.avatar_url || '')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    // 미리보기 URL 생성
    const preview = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(preview)
  }


  const handleSave = async () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      let newAvatarUrl = avatarUrl

      // 새로운 이미지가 선택된 경우 업로드
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        // Supabase Storage에 업로드
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        // Public URL 가져오기
        const { data: { publicUrl } } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath)

        newAvatarUrl = publicUrl
      }

      // 프로필 업데이트 (닉네임 + 아바타)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          nickname: nickname.trim(),
          avatar_url: newAvatarUrl
        })
        .eq('user_id', user.id)

      if (error) throw error

      alert('프로필이 저장되었습니다!')
      
      // 미리보기 정리
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setSelectedFile(null)
      setPreviewUrl(null)
      
      await loadProfile()
    } catch (error) {
      console.error('프로필 저장 실패:', error)
      alert('프로필 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // 변경사항 취소
    setNickname(profile.nickname || '')
    setAvatarUrl(profile.avatar_url || '')
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
  }

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\. /g, '.').replace(/\.$/, '')
  }

  if (!user || !profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-gray-600">로딩 중...</div>
        </div>
      </div>
    )
  }

  const displayAvatarUrl = previewUrl || avatarUrl
  const hasChanges = 
    nickname.trim() !== profile.nickname || 
    selectedFile !== null ||
    avatarUrl !== profile.avatar_url

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">내 프로필</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 프로필 섹션 */}
        <div className="p-10 flex flex-col items-center">
          {/* 프로필 이미지 */}
          <div className="relative group mb-4">
            <div
              className="w-36 h-36 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-5xl font-semibold cursor-pointer transition-transform hover:scale-105 overflow-hidden border-4 border-white shadow-lg"
              onClick={() => document.getElementById('avatarInput')?.click()}
            >
              {displayAvatarUrl ? (
                <img src={displayAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getProfileInitial(nickname, user.email)
              )}
            </div>
            <div
              className="absolute inset-0 w-36 h-36 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => document.getElementById('avatarInput')?.click()}
            >
              <span className="text-white text-sm font-medium">변경</span>
            </div>
          </div>

          <input
            type="file"
            id="avatarInput"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            disabled={loading}
          />

          <button
            onClick={() => document.getElementById('avatarInput')?.click()}
            disabled={loading}
            className="mb-8 px-5 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이미지 업로드
          </button>

          {/* 프로필 정보 */}
          <div className="w-full space-y-6">
            {/* 닉네임 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  //한글,영문,숫자,공백만 허용
                  const regex = /^[ㄱ-ㅎ|가-힣|a-z|A-Z|0-9|\s]+$/
                  if (regex.test(e.target.value)) {
                    setNickname(e.target.value)
                  }
                  else {
                    alert('한글,영문,숫자,공백만 허용합니다.')
                  }
                }}
                placeholder="닉네임을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">이메일</label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-base text-gray-700">
                {user.email}
              </div>
            </div>

            {/* 가입일 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">가입일</label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-base text-gray-700">
                {formatDate(user.created_at)}
              </div>
            </div>

            {/* 저장/취소 버튼 */}
            {hasChanges && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-100 border border-gray-300 rounded-lg text-base text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-lg text-base font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-px bg-gray-200 mx-10"></div>

        {/* 로그아웃 */}
        <div className="p-10 pt-8">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-white border border-gray-300 rounded-lg text-base text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
