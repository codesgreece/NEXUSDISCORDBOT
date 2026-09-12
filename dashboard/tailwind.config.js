/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: '#0b0d12',
          panel: '#12151c',
          card: '#161a23',
          border: '#242a38',
          muted: '#8b93a7',
          text: '#e8ecf5',
          purple: '#7c6cff',
          blue: '#4f8cff',
          success: '#3dd68c',
          danger: '#ff5c7a',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(124, 108, 255, 0.18)',
      },
      backgroundImage: {
        'nexus-radial':
          'radial-gradient(ellipse at top, rgba(124,108,255,0.18), transparent 55%), radial-gradient(ellipse at bottom right, rgba(79,140,255,0.12), transparent 45%)',
      },
    },
  },
  plugins: [],
};
