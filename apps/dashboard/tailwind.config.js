/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0c10",
        foreground: "#ededed",
        surface: {
          50: "#12161f",
          100: "#181e2b",
          200: "#222a3d",
          300: "#2d3752",
        },
        terminal: {
          green: "#00ff66",
          cyan: "#00f0ff",
          purple: "#9d4edd",
          red: "#ff3366",
          amber: "#ffb703",
        }
      },
    },
  },
  plugins: [],
};
