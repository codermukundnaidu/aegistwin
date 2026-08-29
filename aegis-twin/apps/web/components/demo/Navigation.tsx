import Link from "next/link";
import { Activity, Boxes, FileSearch, MonitorPlay, Play, RadioTower, Shield, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

const links = [
  { href: "/", label: "Demo", icon: MonitorPlay },
  { href: "/sandbox", label: "Sandbox", icon: Activity },
  { href: "/architecture", label: "Architecture", icon: Boxes },
  { href: "/evidence", label: "Evidence", icon: FileSearch },
  { href: "/hardware", label: "Hardware", icon: Wrench },
  { href: "/protocol", label: "Protocol", icon: RadioTower },
];

export function Navigation({ active }: { active: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark"><BrandLogo compact /></span>
        <span>
          <strong>AEGIS-TWIN</strong>
          <span>AI diagnoses. Twin predicts. OBC decides.</span>
        </span>
      </Link>
      <nav className="nav" aria-label="Primary navigation">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link className={active === link.label.toLowerCase() ? "active" : ""} href={link.href} key={link.href}>
              <Icon size={15} />
              {link.label}
            </Link>
          );
        })}
        <Link className={active === "demo" ? "active" : ""} href="/demo">
          <Shield size={15} />
          Kiosk
        </Link>
      </nav>
      <Link className="run-cta" href="/sandbox">
        Run Scenario
        <Play size={16} />
      </Link>
    </header>
  );
}
