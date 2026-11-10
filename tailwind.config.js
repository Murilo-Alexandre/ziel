/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* Design tokens do Ziel (direção: reference-ziel9): grafite + blocos de cor + botões circulares pretos. */
      colors: {
        ziel: {
          bg: '#1C1C1E',
          surface: '#262628',
          raised: '#313134',
          line: '#3C3C40',
          'line-soft': '#2F2F33',
          ink: '#141414', // texto/ícones sobre blocos coloridos e botões circulares
          text: '#F4F4F1',
          sub: '#CFCFCA',
          muted: '#9C9C98',
          accent: '#F6C85F',
          'accent-soft': 'rgba(246,200,95,0.16)',
          success: '#BFD86A',
          'success-soft': 'rgba(191,216,106,0.16)',
          warning: '#F6C85F',
          'warning-soft': 'rgba(246,200,95,0.16)',
          danger: '#F0766D',
          'danger-soft': 'rgba(240,118,109,0.16)',
        },
        block: {
          lime: '#C8DA7A',
          amber: '#F6C85F',
          coral: '#E8594F',
          sand: '#DAD8CF',
          sky: '#9CCBEA',
          lilac: '#BBA8F2',
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
