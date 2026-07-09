import { Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-gold text-gold-foreground">
            <Landmark className="size-5" />
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-navy-foreground">
            Freedom Legacy
          </span>
        </Link>
        <a
          href="#get-started"
          className="rounded-md border border-gold/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold hover:text-gold-foreground"
        >
          Get the Framework
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-foreground/70">
      <div className="mx-auto max-w-6xl px-5 py-10 text-center text-xs leading-relaxed">
        <p className="font-serif text-base text-navy-foreground">{siteConfig.brand} Inc.</p>
        <p className="mt-2">
          © {new Date().getFullYear()} {siteConfig.brand} Inc. | All Rights Reserved
          <br />A subsidiary of SCS Legacy System Holding Inc.
        </p>
        <p className="mt-4 text-navy-foreground/50">
          We process your personal data as stated in our Privacy Policy. You may withdraw your
          consent at any time.
        </p>
      </div>
    </footer>
  );
}
