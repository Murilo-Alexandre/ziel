/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* Design tokens do Ziel (direção: reference-ziel9): grafite + blocos de cor + botões circulares pretos. */
      colors: {
        ziel: {
          bg: '#141926',
          surface: '#1D2433',
          raised: '#283046',
          line: '#38425C',
          'line-soft': '#2B3349',
          ink: '#0F1320', // texto/ícones sobre superfícies coloridas
          text: '#F3F5FA',
          sub: '#D0D6E4',
          muted: '#A9B2C8',
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
      borderRadius: { card: '24px', sheet: '28px', chip: '16px' },
      minHeight: { touch: '40px' },
      minWidth: { touch: '40px' },
    },
  },
  plugins: [],
};
