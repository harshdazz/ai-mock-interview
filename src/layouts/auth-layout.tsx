import { Outlet } from "react-router-dom";

/**
 * The background image is decorative and is painted after the form, so without
 * pointer-events-none it covers the whole viewport and swallows every click on
 * the sign-in button. Nothing reports an error when that happens: the click
 * simply lands on an image.
 *
 * h-screen with overflow-hidden also clipped the sign-up form, which is taller
 * than sign-in by one field, on short viewports. min-h-screen lets the page
 * scroll instead.
 */
const AuthenticationLayout = () => (
  <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
    <img
      src="/assets/img/bg.png"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
    />
    <div className="relative flex w-full justify-center">
      <Outlet />
    </div>
  </div>
);

export default AuthenticationLayout;
