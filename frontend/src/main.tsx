import '@fontsource-variable/inter'
import '@fontsource/hind-siliguri/400.css'
import '@fontsource/hind-siliguri/600.css'
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import { ThemeSync } from '@/ThemeSync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 3500 }} />
    </QueryClientProvider>
  </StrictMode>,
)
