/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        alesp: {DEFAULT:'#0b2f6a', light:'#1e4db7'}
      }
    }
  },
  plugins: []
}
