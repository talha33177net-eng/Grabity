import { useBootstrap, useBrandTheme } from '@/hooks/useStore'

/** Applies store-wide settings (brand color, currency, favicon) as soon as they load. */
export function ThemeSync() {
  const { data } = useBootstrap()
  useBrandTheme(data?.settings)
  return null
}
