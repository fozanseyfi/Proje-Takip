"use client";

import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Login: kendi full-page landing layout'unu taşır (Header + Hero + Showcase + Footer)
  // Diğer auth sayfaları (forgot-password, invite/[token]): küçük merkezi kart
  const isFullPage = pathname === "/login";

  if (isFullPage) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative bg-bg-soft">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_20%_0%,rgba(16,185,129,0.06),transparent_70%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_50%_at_100%_100%,rgba(245,158,11,0.05),transparent_70%)]" />
      {children}
    </div>
  );
}
