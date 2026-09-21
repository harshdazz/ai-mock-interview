/**
 * Public navigation. Every entry must correspond to a route defined in App.tsx:
 * this list previously carried /contact, /about and /services, none of which
 * existed, so three of the four nav links landed on the 404 page.
 *
 * Signed-in destinations are not listed here. The header adds those itself,
 * because they should not appear to a signed-out visitor.
 */
export const MainRoutes = [{ label: "Home", href: "/" }];
