/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          DEFAULT: '#006162',
          dark: '#004f50',
        },
        primary: {
          DEFAULT: '#006162',
          container: '#2c7a7b',
        },
        secondary: {
          DEFAULT: '#006a68',
          container: '#91f0ed',
          fixed: '#94f2f0',
          'fixed-dim': '#77d6d3',
        },
        surface: {
          DEFAULT: '#f9f9ff',
          container: '#e7eeff',
          'container-low': '#f0f3ff',
          'container-lowest': '#ffffff',
          'container-high': '#dee8ff',
        },
        outline: {
          DEFAULT: '#6f7979',
          variant: '#bec9c8',
        },
      },
      fontFamily: {
        headline: ['"Atkinson Hyperlegible Next"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
