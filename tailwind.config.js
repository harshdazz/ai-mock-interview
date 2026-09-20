/** @type {import('tailwindcss').Config} */
const c = (name) => `oklch(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // shadcn's expected names, mapped onto the product's tokens so the
        // existing primitives keep working unchanged.
        background: c("bg"),
        foreground: c("ink"),
        card: { DEFAULT: c("surface"), foreground: c("ink") },
        popover: { DEFAULT: c("surface"), foreground: c("ink") },
        primary: { DEFAULT: c("primary"), foreground: c("primary-ink") },
        secondary: { DEFAULT: c("surface-2"), foreground: c("ink") },
        muted: { DEFAULT: c("surface-2"), foreground: c("ink-muted") },
        accent: { DEFAULT: c("surface-2"), foreground: c("ink") },
        // Destructive is amber, not red. Red is reserved for recording state:
        // a user mid-answer must never confuse "you are live" with "something
        // broke". See DESIGN.md.
        destructive: { DEFAULT: c("warning"), foreground: c("primary-ink") },
        border: c("border"),
        input: c("border-strong"),
        ring: c("primary"),

        // Product tokens beyond the shadcn set.
        surface: { DEFAULT: c("surface"), 2: c("surface-2") },
        ink: { DEFAULT: c("ink"), muted: c("ink-muted"), faint: c("ink-faint") },
        live: c("live"),
        success: c("success"),
        warning: c("warning"),
      },
      zIndex: {
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        backdrop: "var(--z-backdrop)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
      },
      transitionTimingFunction: {
        // Ease-out exponential. Nothing bounces: the task is tense enough.
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // The tally light. The only looping animation in the product.
        tally: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.88)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        tally: "tally 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.32s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
