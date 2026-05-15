export function formatBig(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

export function formatProgramAmount(amount) {
  if (amount >= 1e6) return formatBig(amount)
  return `$${amount.toLocaleString()}`
}
