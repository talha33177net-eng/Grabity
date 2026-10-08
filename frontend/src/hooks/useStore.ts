import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { embeddedResponse, http } from '@/lib/api'
import { setCurrencySymbol } from '@/lib/format'
import type { Bootstrap, Home, StoreSettings, User } from '@/lib/types'

export const bootstrapKey = ['bootstrap'] as const

export function useBootstrap() {
  return useQuery({
    queryKey: bootstrapKey,
    queryFn: () => http.get<Bootstrap>('/store/bootstrap'),
    initialData: () => embeddedResponse<Bootstrap>('/store/bootstrap'),
    staleTime: 5 * 60_000,
  })
}

/** Homepage content; also read by the promo popup. */
export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: () => http.get<Home>('/store/home'),
    initialData: () => embeddedResponse<Home>('/store/home'),
    staleTime: 60_000,
  })
}

/** Store settings with safe defaults while loading. */
export function useSettings(): StoreSettings | undefined {
  return useBootstrap().data?.settings
}

/** Applies the admin-selected brand color, currency symbol and favicon to the document. */
export function useBrandTheme(settings: StoreSettings | undefined) {
  useEffect(() => {
    if (!settings) return
    const color = settings.general.primaryColor
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      document.documentElement.style.setProperty('--brand', color)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    }
    setCurrencySymbol(settings.general.currencySymbol)
    if (settings.general.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = settings.general.faviconUrl
    }
  }, [settings])
}

export const meKey = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => (await http.get<User | undefined>('/auth/me')) ?? null,
    staleTime: 5 * 60_000,
  })
}

export function useIsStaff(user: User | null | undefined) {
  return !!user?.roles.some((r) => r === 'Admin' || r === 'Manager')
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => http.post<void>('/auth/logout'),
    onSuccess: () => {
      client.setQueryData(meKey, null)
      client.removeQueries({ queryKey: ['account'] })
      client.removeQueries({ queryKey: ['admin'] })
    },
  })
}
