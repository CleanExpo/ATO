import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS Configuration
 *
 * Extends Tailwind with CSS custom properties from globals.css
 * for consistent theming across the application.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Accent colors from CSS variables
        accent: {
          primary: 'var(--accent-primary)',
          'primary-light': 'var(--accent-primary-light)',
          'primary-dim': 'var(--accent-primary-dim)',
          secondary: 'var(--accent-secondary)',
          tertiary: 'var(--accent-tertiary)',
        },
        // Semantic colors
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          dim: 'var(--color-success-dim)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
          dim: 'var(--color-warning-dim)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          light: 'var(--color-error-light)',
          dim: 'var(--color-error-dim)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)',
          dim: 'var(--color-info-dim)',
        },
        // Brand colors
        xero: {
          DEFAULT: 'var(--color-xero)',
          light: 'var(--color-xero-light)',
          dim: 'var(--color-xero-dim)',
        },
        indigo: {
          DEFAULT: 'var(--color-indigo)',
          light: 'var(--color-indigo-light)',
          dim: 'var(--color-indigo-dim)',
        },
        cyan: {
          DEFAULT: 'var(--color-cyan)',
          light: 'var(--color-cyan-light)',
          dim: 'var(--color-cyan-dim)',
        },
      },
      backgroundColor: {
        base: 'var(--bg-base)',
        subtle: 'var(--bg-subtle)',
        card: 'var(--bg-card)',
        'card-hover': 'var(--bg-card-hover)',
        tertiary: 'var(--bg-tertiary)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
        inverse: 'var(--text-inverse)',
      },
      borderColor: {
        light: 'var(--border-light)',
        medium: 'var(--border-medium)',
        strong: 'var(--border-strong)',
        default: 'var(--border-default)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        inner: 'var(--shadow-inner)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
    },
  },
  plugins: [],
}

export default config
