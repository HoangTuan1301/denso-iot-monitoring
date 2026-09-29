// tailwind.config.js
import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Màu hệ thống nhà máy — được map sang CSS Variables
        factory: {
          bg:       "rgb(var(--bg-base) / <alpha-value>)",
          card:     "rgb(var(--bg-elevated) / <alpha-value>)",
          surface:  "rgb(var(--bg-surface) / <alpha-value>)",
          border:   "rgb(var(--border) / <alpha-value>)",
          sidebar:  "rgb(var(--sidebar-bg) / <alpha-value>)",
          sidebarBorder: "rgb(var(--sidebar-border) / <alpha-value>)",
        },
        // Màu trạng thái cố định
        status: {
          safe:     "#10B981", // emerald-500
          warning:  "#F59E0B", // amber-500
          critical: "#EF4444", // red-500
        },
      },
      animation: {
        "alarm-blink": "alarmBlink 1.1s ease-in-out infinite",
      },
      keyframes: {
        alarmBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
    },
  },
  plugins: [
    heroui({
      defaultTheme: "dark",
      themes: {
        dark: {
          colors: {
            background: "#0B0F17",
            foreground: "#F8FAFC",
            primary:    { DEFAULT: "#10B981", foreground: "#FFFFFF" },
            success:    { DEFAULT: "#10B981", foreground: "#FFFFFF" },
          },
        },
        light: {
          colors: {
            background: "#F1F4F8",
            foreground: "#0F172A",
            primary:    { DEFAULT: "#10B981", foreground: "#FFFFFF" },
            success:    { DEFAULT: "#10B981", foreground: "#FFFFFF" },
          },
        },
      },
    }),
  ],
};
