import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="flex h-16 w-full items-center justify-between border-b border-border bg-surface">
      <Link to="/" className="shrink-0 pl-12 text-lg font-semibold text-accent">
        federaltaxdollars.org
      </Link>
      <Link
        to="/"
        className="mr-12 shrink-0 rounded-lg bg-accent-lt px-4 py-2 text-sm font-semibold text-accent"
      >
        Search new ZIP
      </Link>
    </nav>
  )
}
