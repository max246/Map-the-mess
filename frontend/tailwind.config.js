/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#22c55e', dark: '#16a34a' },
      },
      keyframes: {
        'fade-in-out': {
          '0%': { opacity: '0', transform: 'translate(-50%, -8px)' },
          '10%': { opacity: '1', transform: 'translate(-50%, 0)' },
          '80%': { opacity: '1', transform: 'translate(-50%, 0)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -8px)' },
        },
      },
      animation: {
        'fade-in-out': 'fade-in-out 2.5s ease-in-out forwards',
      },
    },
  },
  plugins: [],
}
