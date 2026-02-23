"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "ダッシュボード", exact: true },
  { href: "/admin/displays", label: "ディスプレイ" },
  { href: "/admin/files", label: "ファイル" },
  { href: "/admin/groups", label: "グループ" },
  { href: "/admin/schedules", label: "スケジュール" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-gray-700">
          <h1 className="text-xl font-bold tracking-wide">LED Manager</h1>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-6 py-4 text-base font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-10">{children}</div>
      </main>
    </div>
  );
}
