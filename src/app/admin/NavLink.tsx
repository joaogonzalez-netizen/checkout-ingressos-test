"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./components/Icon";

export function NavLink({
  href,
  children,
  exact = false,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  icon?: IconName;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}
