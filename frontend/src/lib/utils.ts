/**
 * 合并 Tailwind CSS 类名的工具函数
 * 简单实现，不依赖 clsx/tailwind-merge
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
