/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1e3a5f", light: "#2c5282", dark: "#0f2744" },
        accent: "#f97316",
        "accent-light": "#fb923c",
      },
    },
  },
  plugins: [],
};
