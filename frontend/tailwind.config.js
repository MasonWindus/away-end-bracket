/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        away: {
          forest: '#0D2318',
          green: '#1A3828',
          moss: '#2A5240',
          gold: '#F2C200',
          'gold-light': '#F7D033',
          orange: '#C45231',
          'orange-light': '#D4694A',
          cream: '#F5F0DF',
        },
      },
      fontFamily: {
        display: ['"Bangers"', 'cursive'],
        ui: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
