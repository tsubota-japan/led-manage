"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

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
    <div className={styles.shell}>
      <div className={styles.window}>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#b91c1c" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white tracking-wide">LED Manager</span>
          </div>

          <div className="h-px mx-5 bg-zinc-800" />

          <nav className={styles.sidebarNav}>
            {navItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>

      </div>
    </div>
  );
}
