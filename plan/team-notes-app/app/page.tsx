import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<{ code?: string; error?: string; error_code?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const { code, error, error_code } = params

  if (code) {
    redirect(`/auth/callback?code=${code}&next=/reset-password`)
  }

  if (error) {
    const query = error_code ? `?error_code=${error_code}` : ''
    redirect(`/login${query}`)
  }

  redirect('/login')
}
