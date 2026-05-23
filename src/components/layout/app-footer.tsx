import { Globe, Mail } from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="px-4 sm:px-6 lg:px-8 py-3 max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-x-5 gap-y-2 text-[13px] text-text3 leading-tight">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span>© 2026</span>
          <span className="font-semibold text-text">Proje Yönetim Platformu</span>
          <span className="text-text3">·</span>
          <span>Tasarım &amp; Geliştirme:</span>
          <a
            href="https://fozanseyfi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-text hover:text-accent transition-colors"
          >
            Furkan Ozan Seyfi
          </a>
        </div>
        <div className="flex items-center gap-0.5">
          <FooterIcon href="https://www.linkedin.com/in/fozanseyfi/" icon={LinkedinIcon} title="LinkedIn" />
          <FooterIcon href="https://fozanseyfi.com" icon={Globe} title="Web Sitesi" />
          <FooterIcon href="mailto:fozanseyfi@gmail.com" icon={Mail} title="E-posta" />
        </div>
      </div>
    </footer>
  );
}

function FooterIcon({
  href,
  icon: Icon,
  title,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text3 hover:text-accent hover:bg-bg2 transition-colors"
    >
      <Icon className="size-3.5" />
    </a>
  );
}
