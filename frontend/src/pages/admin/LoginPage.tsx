import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { LogoMark } from '@/components/store/Logo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { meKey, useBootstrap, useIsStaff, useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { User } from '@/lib/types'
import { img } from '@/lib/utils'

export default function AdminLoginPage() {
  useDocumentMeta({ title: 'Admin sign in', noIndex: true })
  const [params] = useSearchParams()
  const redirect = params.get('redirect')?.startsWith('/admin') ? params.get('redirect')! : '/admin'
  const { data: me } = useMe()
  const isStaff = useIsStaff(me)
  const client = useQueryClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const bootstrap = useBootstrap().data
  const canReset = !!bootstrap?.passwordResetByEmail
  const logoUrl = bootstrap?.settings.general.logoUrl

  const login = useMutation({
    mutationFn: () => http.post<User>('/auth/login', { identifier: email, password, rememberMe: true }),
    onSuccess: (user) => {
      client.setQueryData(meKey, user)
      if (!user.roles.some((r) => r === 'Admin' || r === 'Manager')) {
        toast.error('This account does not have admin access.')
        return
      }
      navigate(redirect, { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isStaff && !login.isPending) return <Navigate to={redirect} replace />

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 bg-[radial-gradient(circle_at_top,var(--color-brand-deep),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {logoUrl ? <img src={img(logoUrl, 480)} alt="" className="h-16 w-auto max-w-full object-contain" /> : <LogoMark className="size-14" />}
          <h1 className="mt-4 text-2xl font-bold text-white">Admin panel</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to manage your store</p>
        </div>
        <form
          className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          onSubmit={(e) => {
            e.preventDefault()
            login.mutate()
          }}
        >
          <Field label="Email" htmlFor="email" required>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Password" htmlFor="password" required>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={login.isPending} leftIcon={<Lock className="size-4" />}>
            Sign in
          </Button>
          {canReset && (
            <p className="text-center text-sm">
              <Link to="/forgot-password?admin=1" className="font-medium text-brand hover:underline">
                Forgot password?
              </Link>
            </p>
          )}
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          <a href="/" className="hover:text-slate-300">
            ← Back to store
          </a>
        </p>
      </div>
    </div>
  )
}
