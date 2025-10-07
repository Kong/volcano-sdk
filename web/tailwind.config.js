/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Standardized spacing scale
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },
      // Standardized font sizes
      fontSize: {
        // Body text scales
        xs: ["0.75rem", { lineHeight: "1rem" }], // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
        base: ["1rem", { lineHeight: "1.5rem" }], // 16px
        lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20px
        // Heading scales
        "2xl": ["1.5rem", { lineHeight: "2rem" }], // 24px
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36px
        "5xl": ["3rem", { lineHeight: "1" }], // 48px
        "6xl": ["3.75rem", { lineHeight: "1" }], // 60px
        // Responsive heading scales
        h1: ["2.5rem", { lineHeight: "1.1" }], // 40px desktop
        "h1-mobile": ["2rem", { lineHeight: "1.2" }], // 32px mobile
        h2: ["2rem", { lineHeight: "1.2" }], // 32px desktop
        "h2-mobile": ["1.5rem", { lineHeight: "1.3" }], // 24px mobile
        h3: ["1.5rem", { lineHeight: "1.3" }], // 24px
        "h3-mobile": ["1.25rem", { lineHeight: "1.4" }], // 20px mobile
      },
      // Container max widths
      maxWidth: {
        content: "65rem", // Main content max-width
        sidebar: "16rem", // Sidebar width
        toc: "14rem", // Table of contents width
      },
      // Standardized padding/margin utilities
      padding: {
        section: "4rem", // Standard section padding
        "section-mobile": "3rem", // Mobile section padding
        container: "2rem", // Container side padding
        "container-mobile": "1rem", // Mobile container padding
      },
      colors: {
        "btn-primary": {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          active: "#1d4ed8",
        },
        background: {
          DEFAULT: "white",
          dark: "#111827",
        },
      },
      backgroundColor: {
        default: "white",
      },
    },
  },
};
