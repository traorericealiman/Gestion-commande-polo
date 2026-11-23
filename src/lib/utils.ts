export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}
