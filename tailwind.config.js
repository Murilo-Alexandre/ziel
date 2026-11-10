/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* Design tokens do Ziel (direção: reference-ziel9): grafite + blocos de cor + botões circulares pretos. */
      colors: {
        ziel: {
          bg: '#0E0F14',
          surface: '#171A22',
          raised: '#20242E',
          line: '#2D3240',
          'line-soft': '#232733',
          ink: '#0E0F14', // texto/ícones sobre superfícies coloridas
          text: '#F2F4F8',
          sub: '#C3C8D4',
          muted: '#8E95A5',
          accent: '#F28B82',
          'accent-soft': 'rgba(242,139,130,0.16)',
          success: '#62C48A',
          'success-soft': 'rgba(98,196,138,0.16)',
          warning: '#F5C542',
          'warning-soft': 'rgba(245,197,66,0.16)',
          danger: '#F2706A',
          'danger-soft': 'rgba(242,112,106,0.16)',
        },
        block: {
          coral: '#F28B82',
          blue: '#5B9BE0',
          green: '#62C48A',
          yellow: '#F5C542',
          violet: '#8B7CF6',
          magenta: '#E066D0',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { card: '32px', sheet: '36px', chip: '20px' },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
