/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@chatscope/chat-ui-kit-react/dist/**/*.js"
  ],
  theme: {
    extend: {
      borderRadius: { '2xl': 'var(--radius)' },
      boxShadow: { card: 'var(--shadow)' },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        border: 'var(--border)',
        ringc: 'var(--ring)',
      }
    }
  },
  plugins: [
    // focus ring по умолчанию
    function ({ addBase }) {
      addBase({
        ':root': {'--tw-ring-color': 'var(--ring)'},
        '*:focus-visible': { outline: 'none', boxShadow: '0 0 0 3px var(--ring)' }
      })
    }
  ]
}
