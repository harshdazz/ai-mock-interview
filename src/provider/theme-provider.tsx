import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * Dark is the product's default, not the system's preference.
 *
 * The session screen is a webcam feed in a dim room; a white page turns the
 * screen into a mirror and floodlights the user's face while they are already
 * self-conscious. Light is fully designed and one toggle away, but we do not
 * hand users to it based on an OS setting chosen for their email client.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem={false}
    disableTransitionOnChange
  >
    {children}
  </NextThemeProvider>
);
