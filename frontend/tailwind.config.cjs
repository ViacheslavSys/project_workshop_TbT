module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        border: 'var(--border)'
      },
      boxShadow: {
        card: 'var(--shadow)'
      },
      borderRadius: {
        '2xl': 'var(--radius)'
      }
    }
  },
  plugins: [
    function ({ addBase }) {
      addBase({
        ':root': {'--tw-ring-color': 'var(--ring)'},
        '*:focus-visible': { outline: 'none', boxShadow: '0 0 0 3px var(--ring)' }
      })
    }
  ]
};
