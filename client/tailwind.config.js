/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ánh xạ màu Nền
        background: "var(--bg-background)",
        surface: "var(--bg-surface)",
        hover: "var(--bg-hover)",

        // Ánh xạ màu Chữ
        foreground: "var(--text-foreground)",
        muted: "var(--text-muted)",
        "on-primary": "var(--text-on-primary)",

        // Ánh xạ màu Viền
        border: "var(--border-main)",

        // Ánh xạ màu Chủ đạo (Primary) - ĐÂY LÀ CHỖ GIÚP LOGO CÓ MÀU XANH
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
        },
      },
    },
  },
  plugins: [],
};
