/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* Design tokens do Ziel: única fonte de cores/raios/tipografia. Evite hex soltos nos componentes. */
      colors: {
        ziel: {
          bg: '#0B0D12',
          surface: '#13161E',
          raised: '#1A1E29',
          line: '#262B38',
          'line-soft': '#1E2330',
          text: '#EDF0F6',
          sub: '#B4BBCB',
          muted: '#8B93A6',
          accent: '#6D9BFF',
          'accent-soft': 'rgba(109,155,255,0.14)',
          success: '#6FD6A3',
          'success-soft': 'rgba(111,214,163,0.14)',
          warning: '#EDB65C',
          'warning-soft': 'rgba(237,182,92,0.14)',
          danger: '#EE7F7A',
          'danger-soft': 'rgba(238,127,122,0.14)',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '20px', sheet: '28px', chip: '14px' },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { 'sheet-up': 'sheet-up 220ms ease-out', fade: 'fade 180ms ease-out' },
    },
  },
  plugins: [],
};
