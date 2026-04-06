"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const railItems = [
  { label: "OPS", detail: "Board", href: "/dashboard" },
  { label: "MAP", detail: "Zone", href: "/dashboard/map" },
  { label: "CAS", detail: "Cases", href: "/dashboard/cases" },
  { label: "COM", detail: "Calls", href: "/dashboard" },
  { label: "RTE", detail: "Routes", href: "/dashboard" },
  { label: "DMO", detail: "Demo", href: "/dashboard" },
];

export function OpsRail() {
  const pathname = usePathname();

  return (
    <aside className="ops-rail" aria-label="Operations shortcuts">
      <div className="ops-rail-header">
        <button className="ops-rail-menu" type="button" aria-label="Open command menu">
          MENU
        </button>
      </div>
      <nav className="ops-rail-stack">
        {railItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              href={item.href}
              className={`ops-rail-item ${isActive ? "active" : ""}`}
              key={item.label}
            >
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </Link>
          );
        })}
      </nav>
      <div className="ops-rail-footer">
        <div className="ops-rail-avatar">EO</div>
      </div>
    </aside>
  );
}
