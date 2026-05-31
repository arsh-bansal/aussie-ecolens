import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        eco: {
          bg:      'var(--bg)',
          surface: 'var(--surface)',
          card:    'var(--card)',
          border:  'var(--border)',
          primary: 'var(--primary)',
          light:   'var(--primary-light)',
          accent:  'var(--accent)',
          warm:    'var(--accent-warm)',
          text:    'var(--text)',
          muted:   'var(--muted)',
          danger:  'var(--danger)',
        },
        forest: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        dark: {
          50:  '#1a2e1a',
          100: '#142014',
          200: '#0f180f',
          300: '#0a120a',
          400: '#070d07',
          500: '#040804',
        },
        wattle:  '#e9c46a',
        outback: '#f4a261',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body:    ['var(--font-body)',    'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'monospace'],
      },
      boxShadow: {
        'glow-sm':   '0 0 10px rgba(74,222,128,0.15)',
        glow:        '0 0 20px rgba(74,222,128,0.25)',
        'glow-lg':   '0 0 40px rgba(74,222,128,0.35)',
        card:        '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,222,128,0.08)',
        'card-hover':'0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,222,128,0.18)',
        eco:         'var(--shadow)',
        'eco-card':  'var(--shadow-card)',
        'eco-hover': 'var(--shadow-hover)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        float:        'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'leaf-1':     'leaf-float-1 22s ease-in-out infinite',
        'leaf-2':     'leaf-float-2 18s ease-in-out infinite 4s',
        'leaf-3':     'leaf-float-3 25s ease-in-out infinite 8s',
        'bounce-slow':'empty-bounce 2.5s ease-in-out infinite',
        'mail-bob':   'mail-bob 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        float:   { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
      },
    },
  },
  plugins: [],
};

export default config;