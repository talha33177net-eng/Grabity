import { useMutation } from '@tanstack/react-query'
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon, WhatsAppIcon, XIcon, YouTubeIcon } from '@/components/ui/Icons'
import { useBootstrap } from '@/hooks/useStore'
import { errorMessage, http } from '@/lib/api'
import type { FooterLink } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

export function Footer() {
  const { data } = useBootstrap()
  const settings = data?.settings
  const pages = data?.footerPages ?? []
  const group = (g: FooterLink['group']) => pages.filter((p) => p.group === g)
  const year = new Date().getFullYear()

  const socials = [
    { href: settings?.social.facebook, label: 'Facebook', icon: FacebookIcon, color: 'hover:bg-[#1877f2]' },
    { href: settings?.social.instagram, label: 'Instagram', icon: InstagramIcon, color: 'hover:bg-[#e1306c]' },
    { href: settings?.social.youTube, label: 'YouTube', icon: YouTubeIcon, color: 'hover:bg-[#ff0000]' },
    { href: settings?.social.tikTok, label: 'TikTok', icon: TikTokIcon, color: 'hover:bg-black' },
    { href: settings?.social.linkedIn, label: 'LinkedIn', icon: LinkedInIcon, color: 'hover:bg-[#0a66c2]' },
    { href: settings?.social.x, label: 'X', icon: XIcon, color: 'hover:bg-black' },
    { href: settings?.contact.whatsAppNumber ? `https://wa.me/${settings.contact.whatsAppNumber}` : null, label: 'WhatsApp', icon: WhatsAppIcon, color: 'hover:bg-[#25d366]' },
  ].filter((s) => s.href)

  const showNewsletter = settings?.footer.showNewsletter !== false

  return (
    <footer className={cn('bg-brand-night text-slate-300', showNewsletter ? 'mt-28' : 'mt-16')}>
      {showNewsletter && (
        <div className="container-x">
          {/* Sits half over the page above, half over the footer. */}
          <div className="relative isolate -mt-14 overflow-hidden rounded-3xl bg-linear-to-br from-brand via-brand-hover to-brand-deep px-6 py-8 shadow-2xl shadow-brand-ring sm:px-10 sm:py-10">
            <span aria-hidden className="absolute -top-20 -right-10 -z-10 size-64 rounded-full bg-white/10" />
            <span aria-hidden className="absolute -bottom-24 left-1/3 -z-10 size-56 rounded-full bg-white/10" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 sm:flex">
                  <Mail className="size-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white sm:text-2xl">Get the best deals first</h2>
                  <p className="mt-1 text-sm text-white/80 sm:text-base">New arrivals, flash sales and exclusive coupons — straight to your inbox.</p>
                </div>
              </div>
              <Newsletter />
            </div>
          </div>
        </div>
      )}

      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-14">
        <div>
          <Logo light />
          {settings?.footer.aboutText && <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{settings.footer.aboutText}</p>}
          <ul className="mt-5 space-y-2.5 text-sm">
            {settings?.contact.phone && (
              <ContactLine icon={<Phone className="size-4" />}>
                <a href={`tel:${settings.contact.phone.replace(/[^+\d]/g, '')}`} className="hover:text-white">
                  {settings.contact.phone}
                </a>
              </ContactLine>
            )}
            {settings?.contact.email && (
              <ContactLine icon={<Mail className="size-4" />}>
                <a href={`mailto:${settings.contact.email}`} className="hover:text-white">
                  {settings.contact.email}
                </a>
              </ContactLine>
            )}
            {settings?.contact.address && (
              <ContactLine icon={<MapPin className="size-4" />}>
                {settings.contact.mapUrl ? (
                  <a href={settings.contact.mapUrl} target="_blank" rel="noreferrer" className="hover:text-white">
                    {settings.contact.address}
                  </a>
                ) : (
                  settings.contact.address
                )}
              </ContactLine>
            )}
            {settings?.contact.businessHours && <ContactLine icon={<Clock className="size-4" />}>{settings.contact.businessHours}</ContactLine>}
          </ul>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map(({ href, label, icon: Icon, color }) => (
                <a key={label} href={href!} target="_blank" rel="noreferrer" aria-label={label} className={`flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition ${color}`}>
                  <Icon className="size-4.5" />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterColumn title="About">
          {group('About').map((p) => (
            <FooterItem key={p.slug} to={`/page/${p.slug}`}>
              {p.title}
            </FooterItem>
          ))}
          <FooterItem to="/track-order">Track my order</FooterItem>
          <FooterItem to="/reviews">Customer reviews</FooterItem>
          <FooterItem to="/blog">Blog</FooterItem>
        </FooterColumn>
        <FooterColumn title="Policy">
          {group('Policy').map((p) => (
            <FooterItem key={p.slug} to={`/page/${p.slug}`}>
              {p.title}
            </FooterItem>
          ))}
        </FooterColumn>
        <FooterColumn title="Help">
          {group('Help').map((p) => (
            <FooterItem key={p.slug} to={`/page/${p.slug}`}>
              {p.title}
            </FooterItem>
          ))}
          <FooterItem to="/brands">All brands</FooterItem>
          <FooterItem to="/categories">All categories</FooterItem>
        </FooterColumn>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-3 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings?.footer.copyrightText ?? `${settings?.general.storeName ?? 'Grabity'}. All rights reserved.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1">We accept</span>
            {['Cash on Delivery', 'bKash', 'Nagad'].map((m) => (
              <span key={m} className="rounded-md bg-white/10 px-2 py-1 font-semibold text-slate-200">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-wider text-white uppercase">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  )
}

function FooterItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-slate-400 transition hover:text-white">
        {children}
      </Link>
    </li>
  )
}

function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-slate-400">
      <span className="mt-0.5 text-brand-light">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const subscribe = useMutation({
    mutationFn: () => http.post<{ message: string }>('/newsletter', { email }),
    onSuccess: (r) => {
      toast.success(r.message)
      setEmail('')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <form
      className="flex w-full max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        subscribe.mutate()
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-white px-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-4 focus:ring-white/40 focus:outline-none"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={subscribe.isPending}
        className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        <Send className="size-4" /> Subscribe
      </button>
    </form>
  )
}
