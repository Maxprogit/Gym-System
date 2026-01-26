/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {
      colors: {
        // CORRECCIÓN: Quitamos el anidamiento para que las clases sean directas
        bg: '#09090b',           // Clase: bg-bg
        surface: '#18181b',      // Clase: bg-surface
        primary: '#D4FF00',      // Clase: bg-primary
        accent: '#27272a',       // Clase: bg-accent
        'text-main': '#e4e4e7',  // Clase: text-text-main
        'text-muted': '#a1a1aa'  // Clase: text-text-muted
      },
      fontFamily: {
        heading: ['Inter', 'sans-serif'], 
        mono: ['monospace'],
      }
    },
  },
  plugins: [],
}