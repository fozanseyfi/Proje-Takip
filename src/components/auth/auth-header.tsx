"use client";

import Link from "next/link";
import { Mail, Globe, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function AuthHeader() {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/login" className="flex items-center">
          <Logo size={28} compact textClassName="text-sm" />
        </Link>
        <div className="flex items-center gap-1">
          <SocialIcon href="https://www.linkedin.com/in/fozanseyfi/" icon={LinkedinIcon} title="LinkedIn" />
          <SocialIcon href="https://fozanseyfi.com" icon={Globe} title="Web" />
          <SocialIcon href="mailto:fozanseyfi@gmail.com" icon={Mail} title="E-posta" />
          <Link
            href="/portfolio"
            className="ml-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-white text-xs font-bold hover:brightness-110 transition-all shadow-sm"
          >
            Hemen Dene
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function SocialIcon({
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
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text3 hover:text-accent hover:bg-bg2 transition-colors"
    >
      <Icon className="size-4" />
    </a>
  );
}
