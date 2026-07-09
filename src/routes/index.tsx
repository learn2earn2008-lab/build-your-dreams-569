import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Building2,
  Banknote,
  TrendingUp,
  Check,
  Quote,
} from "lucide-react";

import { CaptureForm } from "@/components/landing/CaptureForm";
import { SiteHeader, SiteFooter } from "@/components/landing/SiteChrome";
import heroBg from "@/assets/hero-bg.jpg";
import ebookCover from "@/assets/ebook-cover.png";

export const Route = createFileRoute("/")({
  component: Index,
});

const pillars = [
  {
    icon: ShieldCheck,
    tag: "Pillar 01",
    title: "Build Elite Personal & Business Credit",
    body: "Your credit is the foundation of everything. Position your personal and business credit so lenders, vendors, and funding sources see you as a low-risk, high-value borrower.",
  },
  {
    icon: Building2,
    tag: "Pillar 02",
    title: "Structure a Bank-Ready, Fundable Business",
    body: "Most businesses get denied funding not because they're bad businesses — but because they're structured wrong. Discover what banks and lenders actually look for.",
  },
  {
    icon: Banknote,
    tag: "Pillar 03",
    title: "Access Funding Without Begging Banks",
    body: "There is capital available for businesses that are properly positioned. Learn the proven path to securing funding — without maxing out cards or draining your savings.",
  },
  {
    icon: TrendingUp,
    tag: "Pillar 04",
    title: "Create Passive Cash Flow",
    body: "Cash flow is the lifeblood of every business. Build passive streams of income that cover overhead, fund slow seasons, and act as a safety net.",
  },
];

const forYou = [
  "You're an entrepreneur who doesn't know where to start with credit or funding",
  "You've been told \"no\" by banks and don't understand why",
  "Your business isn't structured to receive funding — and you don't even know it",
  "You want passive cash flow but have no system to create it",
  "You're tired of guessing, Googling, and going in circles",
];

function Index() {
  return (
    <div className="bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-40"
          width={1920}
          height={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/70 via-navy/85 to-navy" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-32 lg:grid-cols-2 lg:pt-36">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Free Download — The 4 Pillars of Wealth Building
            </p>
            <h1 className="mt-5 text-4xl leading-[1.1] sm:text-5xl">
              Build Real Wealth With a Proven Credit, Funding &amp; Cash Flow Framework
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-foreground/80">
              Download <span className="font-semibold text-gold">The Freedom Legacy Framework</span>{" "}
              — the free guide showing entrepreneurs exactly how to build credit, structure a
              fundable business, secure capital, and create lasting cash flow.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-foreground/70">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-gold" /> Instant free access
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-gold" /> Simple, actionable blueprint
              </span>
            </div>
          </div>

          {/* Capture card */}
          <div id="get-started" className="mx-auto w-full max-w-md scroll-mt-24">
            <div className="rounded-2xl border border-gold/20 bg-card p-6 text-card-foreground shadow-2xl sm:p-8">
              <div className="mb-5 flex items-center gap-4">
                <img
                  src={ebookCover}
                  alt="The Freedom Legacy Framework eBook cover"
                  className="h-24 w-auto drop-shadow-lg"
                  width={912}
                  height={1104}
                  loading="eager"
                />
                <div>
                  <h2 className="text-xl">Get Your FREE Copy</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your details for instant access.
                  </p>
                </div>
              </div>
              <CaptureForm source="landing_hero" />
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <Quote className="mx-auto size-8 text-gold" />
        <h2 className="mt-4 text-2xl leading-snug sm:text-3xl">
          "I was a small business owner with no credit strategy, no funding plan, and no clue where
          to start. This framework changed everything."
        </h2>
        <p className="mt-6 text-muted-foreground">
          Most entrepreneurs grind every day without a clear roadmap — getting denied by banks,
          ignoring their credit, and leaving funding on the table. It's not your fault. Nobody taught
          you this. The Freedom Legacy Framework breaks the 4 Pillars of Wealth Building into a
          simple, actionable blueprint.
        </p>
      </section>

      {/* Pillars */}
      <section className="bg-navy py-20 text-navy-foreground">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              What you'll learn
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl">The 4 Pillars Inside This Guide</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {pillars.map((p) => (
              <div
                key={p.tag}
                className="rounded-xl border border-white/10 bg-navy-muted/50 p-7 transition-colors hover:border-gold/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    <p.icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-gold">
                    {p.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-xl text-navy-foreground">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-foreground/70">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl sm:text-4xl">Who Is This Guide For?</h2>
            <p className="mt-4 text-muted-foreground">
              This is the guide we wish someone had handed us years ago. It's for you if:
            </p>
            <ul className="mt-6 space-y-3">
              {forYou.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                  <span className="text-sm text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-8 shadow-lg">
            <h3 className="text-2xl">Send Me The Free Framework</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Get instant access to all 4 pillars.
            </p>
            <div className="mt-6">
              <CaptureForm source="landing_footer" ctaLabel="Yes — Send It Now" />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
