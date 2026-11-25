/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Bleu ciel du logo A2E (le "A")
        brand: {
          50: '#ECF9FF',
          100: '#D4F1FF',
          200: '#A8E3FE',
          300: '#6BD0FD',
          400: '#2EBEFB',
          500: '#0AB4FA',
          600: '#0090D6',
          700: '#0072AD',
          800: '#035C8C',
          900: '#0A4D73',
          950: '#06314C',
        },
        // Marine du logo (le "E")
        navy: {
          DEFAULT: '#00224A',
          light: '#0A3366',
          dark: '#00152F',
        },
        // Jaune du logo (le "2")
        sun: {
          DEFAULT: '#FCC425',
          soft: '#FFF6D9',
          dark: '#C99600',
        },
        // Vert du liseré
        lime: {
          DEFAULT: '#6AFF2A',
        },
        accent: {
          DEFAULT: '#0090D6',
          soft: '#ECF9FF',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(0, 34, 74, 0.06), 0 1px 2px rgba(0, 34, 74, 0.04)',
        card: '0 12px 40px -12px rgba(0, 34, 74, 0.18)',
        lift: '0 14px 34px -12px rgba(0, 144, 214, 0.45)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
