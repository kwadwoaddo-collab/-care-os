'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    // Check local storage or system preference
    setTimeout(() => {
      const stored = localStorage.getItem('care-os-theme')
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored)
        document.documentElement.classList.toggle('dark', stored === 'dark')
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setTheme(prefersDark ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', prefersDark)
      }
    }, 0)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('care-os-theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  if (!theme) return <div className="w-9 h-9" /> // placeholder to avoid layout shift

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-inverse-surface transition-all flex items-center justify-center"
      aria-label="Toggle dark mode"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-symbols-outlined text-[20px]" data-icon={theme === 'dark' ? 'light_mode' : 'dark_mode'}>
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  )
}
