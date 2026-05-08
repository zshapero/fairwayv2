/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        fairway: {
          50: "#f0f9f3",
          500: "#2f9e58",
          700: "#1f6b3c",
        },
      },
    },
  },
  plugins: [],
};
