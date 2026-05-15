/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        'ink-light': 'var(--color-ink-light)',
        accent: 'var(--color-accent)',
        'accent-lt': 'var(--color-accent-lt)',
        border: 'var(--color-border)',
        cut: 'var(--color-cut)',
        proposed: 'var(--color-proposed)',
        active: 'var(--color-active)',
      },
    },
  },
  plugins: [],
}
