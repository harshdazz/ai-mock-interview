import { Github, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";
import Container from "./conatiner";

// The author's own profiles. The previous footer linked to facebook.com,
// twitter.com and instagram.com -- the sites' front pages, not anybody's
// account -- alongside a "123 AI Street, Tech City" postal address for a
// company that does not exist.
const AUTHOR = {
  github: "https://github.com/harshdazz",
  linkedin: "https://www.linkedin.com/in/harsh-dubey-b2b2b4395",
};

const Social = ({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    // The old version built its hover class by interpolating a prop into
    // `hover:${hoverColor}`. Tailwind scans source text for complete class
    // names, so it never generated those rules and no hover colour applied.
    className="text-ink-muted transition-colors hover:text-ink"
  >
    {children}
  </a>
);

export const Footer = () => (
  <footer className="w-full border-t bg-surface">
    <Container>
      <div className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <p className="max-w-md text-pretty text-sm text-ink-muted">
          Practise technical interviews out loud: describe the role, answer five
          questions with your camera on, and see each answer scored against a
          model answer.
        </p>

        <div className="flex items-center gap-6">
          <nav aria-label="Footer">
            <Link
              to="/"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Home
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Social href={AUTHOR.github} label="GitHub">
              <Github size={20} aria-hidden="true" />
            </Social>
            <Social href={AUTHOR.linkedin} label="LinkedIn">
              <Linkedin size={20} aria-hidden="true" />
            </Social>
          </div>
        </div>
      </div>
    </Container>
  </footer>
);
