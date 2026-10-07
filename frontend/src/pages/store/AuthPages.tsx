import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Logo } from '@/components/store/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { meKey, useBootstrap, useMe } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { User } from '@/lib/types'

function safeRedirect(value: string | null, fallback: string) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="container-x flex justify-center py-8 sm:py-14">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <Logo className="pointer-events-none mb-6" />
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>
      </div>
    </div>
  )
}

function PasswordInput(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <button type="button" onClick={() => setVisible((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  )
}

export function LoginPage() {
  useDocumentMeta({ title: 'Sign in', noIndex: true })
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'), '/account')
  const { data: me } = useMe()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const canReset = !!useBootstrap().data?.passwordResetByEmail

  const login = useMutation({
    mutationFn: () => http.post<User>('/auth/login', { identifier, password, rememberMe: true }),
    onSuccess: (user) => {
      client.setQueryData(meKey, user)
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}!`)
      navigate(redirect, { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (me && !login.isPending && !login.isSuccess) return <Navigate to={redirect} replace />

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders, save your details and check out faster."
      footer={
        <>
          New to Grabity?{' '}
          <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate()
        }}
      >
        <Field label="Email or phone number" htmlFor="identifier" required>
          <Input id="identifier" autoComplete="username" placeholder="01XXXXXXXXX or you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
        {canReset ? (
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="font-medium text-brand hover:underline">
              Forgot your password?
            </Link>
          </p>
        ) : (
          <p className="text-center text-xs text-slate-500">Forgot your password? Contact us and we'll help you reset it.</p>
        )}
      </form>
    </AuthShell>
  )
}

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Please enter your full name'),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .refine((v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v), 'Enter a valid mobile number, e.g. 01712345678'),
    email: z.union([z.literal(''), z.email('Enter a valid email address')]),
    address: z.string().max(500),
    password: z.string().min(6, 'Use at least 6 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "Passwords don't match" })

type RegisterValues = z.input<typeof registerSchema>

export function RegisterPage() {
  useDocumentMeta({ title: 'Create account', noIndex: true })
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'), '/account')
  const { data: me } = useMe()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { register, handleSubmit, formState } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '', email: '', address: '', password: '', confirm: '' },
  })

  const create = useMutation({
    mutationFn: (values: z.output<typeof registerSchema>) =>
      http.post<User>('/auth/register', { fullName: values.fullName, phone: values.phone, email: values.email || null, address: values.address || null, password: values.password }),
    onSuccess: (user) => {
      client.setQueryData(meKey, user)
      toast.success('Your account is ready!')
      navigate(redirect, { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (me && !create.isPending && !create.isSuccess) return <Navigate to={redirect} replace />
  const errors = formState.errors

  return (
    <AuthShell
      title="Create your account"
      subtitle="It only takes a minute. Track orders and check out faster next time."
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((values) => create.mutate(registerSchema.parse(values)))} noValidate>
        <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" {...register('fullName')} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label="Mobile number" htmlFor="phone" required error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...register('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Email (optional)" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Delivery address (optional)" htmlFor="address">
          <Textarea id="address" rows={2} autoComplete="street-address" placeholder="House, road, area, city" {...register('address')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" required error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" {...register('password')} aria-invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} aria-invalid={!!errors.confirm} />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={create.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  useDocumentMeta({ title: 'Forgot password', noIndex: true })
  const [params] = useSearchParams()
  const forStaff = params.get('admin') === '1'
  const [email, setEmail] = useState('')
  const request = useMutation({
    mutationFn: () => http.post<{ message: string }>('/auth/forgot-password', { email: email.trim() }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const signIn = forStaff ? '/admin/login' : '/login'

  return (
    <AuthShell
      title={request.isSuccess ? 'Check your email' : 'Forgot your password?'}
      subtitle={request.isSuccess ? request.data.message : "Enter the email on your account and we'll send you a link to choose a new password."}
      footer={
        <Link to={signIn} className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      {request.isSuccess ? (
        <div className="space-y-4 text-sm text-slate-600">
          <p>The link works for 2 hours. If nothing arrives in a few minutes, check the spam folder or try again.</p>
          <p>Signed up with just your phone number? Contact us and we'll help you get back in.</p>
          <Button variant="outline" className="w-full" onClick={() => request.reset()}>
            Try another email
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            request.mutate()
          }}
        >
          <Field label="Email address" htmlFor="email" required>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={request.isPending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  useDocumentMeta({ title: 'Choose a new password', noIndex: true })
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const reset = useMutation({
    mutationFn: () => http.post<{ isStaff: boolean }>('/auth/reset-password', { email, token, newPassword: password }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const mismatch = confirm.length > 0 && password !== confirm

  if (!email || !token) {
    return (
      <AuthShell title="Link not valid" subtitle="This reset link is incomplete. Please use the button in the email, or request a new link." footer={null}>
        <ButtonLink to="/forgot-password" size="lg" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthShell>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthShell title="Password updated" subtitle="Your new password is ready. Sign in with it now." footer={null}>
        <ButtonLink to={reset.data.isStaff ? '/admin/login' : `/login`} size="lg" className="w-full">
          Sign in
        </ButtonLink>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`For ${email}`}
      footer={
        <Link to="/forgot-password" className="font-semibold text-brand hover:underline">
          Need a new link?
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) reset.mutate()
        }}
      >
        <Field label="New password" htmlFor="password" required hint="At least 6 characters.">
          <PasswordInput id="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" required error={mismatch ? "Passwords don't match" : undefined}>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending} disabled={password.length < 6 || mismatch}>
          Save new password
        </Button>
      </form>
    </AuthShell>
  )
}

export function UnsubscribePage() {
  useDocumentMeta({ title: 'Unsubscribe', noIndex: true })
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  // A button instead of unsubscribing on page load: mail scanners open links in emails automatically.
  const unsubscribe = useMutation({
    mutationFn: () => http.post<{ message: string }>('/newsletter/unsubscribe', { email, token }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <AuthShell
      title={unsubscribe.isSuccess ? "You're unsubscribed" : 'Unsubscribe from emails?'}
      subtitle={unsubscribe.isSuccess ? unsubscribe.data.message : `${email || 'This address'} will stop receiving our newsletter. Order emails are not affected.`}
      footer={
        <Link to="/" className="font-semibold text-brand hover:underline">
          Back to the store
        </Link>
      }
    >
      {!unsubscribe.isSuccess && (
        <Button size="lg" className="w-full" loading={unsubscribe.isPending} disabled={!email || !token} onClick={() => unsubscribe.mutate()}>
          Unsubscribe
        </Button>
      )}
    </AuthShell>
  )
}
