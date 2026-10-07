import { Check } from 'lucide-react'
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-brand focus:ring-3 focus:ring-brand-ring focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-rose-500 aria-invalid:ring-rose-200'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, 'py-2', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-10 pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export function Label({ htmlFor, children, required, className }: { htmlFor?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)}>
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  )
}

interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, ...props }, ref) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-slate-700', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 flex size-4.5 shrink-0">
        <input ref={ref} type="checkbox" className="peer size-4.5 cursor-pointer appearance-none rounded border border-slate-300 bg-white transition checked:border-brand checked:bg-brand focus-visible:ring-3 focus-visible:ring-brand-ring" {...props} />
        <Check className="pointer-events-none absolute inset-0.5 size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {(label || description) && (
        <span>
          {label && <span className="font-medium text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  )
})

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed opacity-60', className)}>
      {(label || description) && (
        <span className="text-sm">
          {label && <span className="font-medium text-slate-800">{label}</span>}
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300')}
      >
        <span className={cn('inline-block size-5 rounded-full bg-white shadow transition', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
    </label>
  )
}

interface RadioCardProps {
  checked: boolean
  onSelect: () => void
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  children?: ReactNode
  name: string
}

/** Large selectable option used for delivery and payment choices. */
export function RadioCard({ checked, onSelect, title, description, aside, children, name }: RadioCardProps) {
  return (
    <label
      className={cn(
        'block cursor-pointer rounded-xl border bg-white p-3.5 transition',
        checked ? 'border-brand ring-3 ring-brand-ring' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <span className="flex items-start gap-3">
        <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
        <span className={cn('mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-brand' : 'border-slate-300')}>
          {checked && <span className="size-2 rounded-full bg-brand" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">{title}</span>
            {aside && <span className="shrink-0 text-sm font-semibold text-slate-900">{aside}</span>}
          </span>
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
        </span>
      </span>
      {checked && children && <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>}
    </label>
  )
}
