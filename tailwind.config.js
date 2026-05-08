/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Token-based palette. Use these names everywhere.
        primary: "#1F4D3F",
        primaryDark: "#163831",
        accent: "#B8965A",
        surface: "#FAF6EE",
        surfaceDeep: "#F0EBE0",
        surfaceElevated: "#FFFFFF",
        ink: "#1A1A1A",
        inkMuted: "#6B6862",
        textOnPrimary: "#FAF6EE",
        positive: "#2D5F4A",
        // Backwards-compat aliases used by older code.
        fairway: {
          50: "#FAF6EE",
          500: "#1F4D3F",
          700: "#163831",
        },
      },
      fontFamily: {
        serif: ["Fraunces_400Regular"],
        "serif-light": ["Fraunces_300Light"],
        "serif-medium": ["Fraunces_500Medium"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
      },
      fontSize: {
        display: ["96px", { lineHeight: "100px", letterSpacing: "-1.92px" }],
        title: ["32px", { lineHeight: "38px", letterSpacing: "-0.32px" }],
        heading: ["20px", { lineHeight: "26px", letterSpacing: "-0.1px" }],
        body: ["16px", { lineHeight: "24px" }],
        caption: ["13px", { lineHeight: "18px" }],
        micro: ["11px", { lineHeight: "14px", letterSpacing: "0.88px" }],
      },
      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        xxxl: "64px",
        hero: "96px",
      },
      borderRadius: {
        sm: "12px",
        md: "20px",
        lg: "28px",
        button: "14px",
      },
    },
  },
  plugins: [],
};
