import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#0B0F14', light: '#131A22' },
        accent: '#D4A24C',
        success: '#3FB98A',
        danger: '#E5484D',
        warning: '#F5A524',
        info: '#4C9FE8',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
