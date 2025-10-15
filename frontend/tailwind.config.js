/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // чат-кит
    "./node_modules/@chatscope/chat-ui-kit-react/dist/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0e1a",
        surface: "#1a1f2e",
        primary: "#2563eb",
        success: "#059669",
        error: "#dc2626",
        text: "#f1f5f9",
      }
    }
  },
  plugins: []
}
