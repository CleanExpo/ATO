'use client'

import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'default' | 'tax-time'

const STORAGE_KEY = 'ato-theme'

/**
 * ThemeToggle - Switch between OLED Black and Tax-Time dark modes
 *
 * Tax-Time mode uses warmer tones and reduced glare for extended
 * sessions during the July-October tax lodgement season.
 *
 * Keyboard shortcut: Ctrl+Shift+T
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('default')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'tax-time') {
      setTheme('tax-time')
      document.documentElement.setAttribute('data-theme', 'tax-time')
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'default' ? 'tax-time' : 'default'

    // Add transition class, then remove after animation
    document.documentElement.classList.add('theme-transitioning')
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning')
    }, 250)

    if (next === 'tax-time') {
      document.documentElement.setAttribute('data-theme', 'tax-time')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }

    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }, [theme])

  // Keyboard shortcut: Ctrl+Shift+T
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        toggleTheme()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [toggleTheme])

  const isTaxTime = theme === 'tax-time'

  return (
    <button
      onClick={toggleTheme}
      className="dynamic-island__item"
      aria-label={isTaxTime ? 'Switch to standard dark mode (currently Tax-Time mode)' : 'Switch to Tax-Time mode for reduced eye strain'}
      title={isTaxTime ? 'Standard mode' : 'Tax-Time mode'}
    >
      {isTaxTime ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
