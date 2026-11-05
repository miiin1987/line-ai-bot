"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "ダッシュボード", exact: true },
  { href: "/admin/faq", label: "FAQ管理", exact: false },
  { href: "/admin/unanswered", label: "未回答質問", exact: false },
  { href: "/admin/broadcast", label: "一斉配信", exact: false },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-gray-100">
      <div className="mx-auto flex max-w-5xl px-2">
        {NAV_ITEMS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
