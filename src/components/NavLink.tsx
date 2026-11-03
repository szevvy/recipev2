"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  className,
  title,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Link href={href} className={className} title={title}>
      {children}
      <PendingDot />
    </Link>
  );
}

function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-block ml-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse align-middle"
    />
  );
}
