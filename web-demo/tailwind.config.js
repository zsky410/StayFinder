/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#f7f3ea",
        pearl: "#fffdfa",
        ink: "#183336",
        tide: "#0f5b5f",
        foam: "#dbece9",
        coral: "#d97b5c",
        amber: "#c9a25f",
        mist: "#edf1eb",
        line: "#d8ddd3",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["IBM Plex Sans", "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 60px rgba(24, 51, 54, 0.12)",
        card: "0 18px 40px rgba(24, 51, 54, 0.10)",
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 1px 1px, rgba(24, 51, 54, 0.08) 1px, transparent 0)",
      },
      keyframes: {
        rise: {
          "0%": {
            opacity: "0",
            transform: "translateY(20px) scale(0.985)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0) scale(1)",
          },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" },
        },
      },
      animation: {
        rise: "rise 0.7s both cubic-bezier(0.22, 1, 0.36, 1)",
        drift: "drift 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
