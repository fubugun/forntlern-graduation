/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#020617',
        emerald: '#10b981',
        amber: '#f59e0b',
        ocean: '#0ea5e9',
      },
    },
  },
  plugins: [],
};

