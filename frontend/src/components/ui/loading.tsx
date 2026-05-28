import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
}

export function Loading({ size = 'md', className, label = '加载中...' }: LoadingProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex items-center justify-center', className)}
    >
      <span
        className={cn(
          'rounded-full border-slate-200 border-t-blue-600 animate-spin',
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <Loading size="lg" />
    </div>
  )
}
