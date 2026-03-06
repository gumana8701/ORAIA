import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0F1E',
        surface: '#111827',
        accent: '#E8792F',
        muted: '#A0AEC0',
      },
      boxShadow: {
        'glow': '0 0 30px rgba(232,121,47,0.35)',
        'glow-sm': '0 0 15px rgba(232,121,47,0.2)',
      },
    },
  },
  plugins: [],
}
export default config
