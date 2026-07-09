import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, CalendarClock, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

import { SiteFooter } from "@/components/landing/SiteChrome";
import { siteConfig } from "@/lib/site-config";
import ebookCover from "@/assets/ebook-cover.png";
import ebookPdf from "@/assets/freedom-legacy-framework.pdf.asset.json";

export const Route = createFileRoute("/thank-you")({
  head: () => ({
    meta: [
      { title: "You're In! — Freedom Legacy Elevation Group" },
      {
        name: "description",
        content:
          "Download your free Freedom Legacy Framework, book a discovery call, and start your free 7-day AI platform trial.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYou,
});

function ThankYou() {
  const steps = [
    {
      icon: Download,
      step: "Step 1",
      title: "Download Your Free eBook",
      body: "Your copy of The Freedom Legacy Framework is ready. Grab it now and start with Pillar 1.",
      cta: "Download the Framework",
      href: ebookPdf.url,
      primary: true,
      download: "The-Freedom-Legacy-Framework.pdf",
    },
    {
      icon: CalendarClock,
      step: "Step 2",
      title: "Book Your Free 30-Minute Discovery Call",
      body: "Get a personalized look at your credit and funding position on a free 30-minute strategy call.",
      cta: "Schedule My Call",
      href: siteConfig.discoveryCallUrl,
      primary: false,
    },
    {
      icon: Sparkles,
      step: "Step 3",
      title: "Start Your Free 7-Day AI Platform Trial",
      body: "Try the AI platform built to help you scale and grow your business — free for 7 days.",
      cta: "Start Free Trial",
      href: siteConfig.aiTrialUrl,
      primary: false,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            <CheckCircle2 className="size-7" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            You're all set
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl">Welcome to the Freedom Legacy family</h1>
          <p className="mx-auto mt-4 max-w-xl text-navy-foreground/80">
            Your free guide is on its way. Here are your next three steps to start building credit,
            funding, and cash flow.
          </p>
          <img
            src={ebookCover}
            alt="The Freedom Legacy Framework eBook cover"
            className="mx-auto mt-8 h-40 w-auto drop-shadow-2xl"
            width={912}
            height={1104}
            loading="eager"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl flex-1 px-5 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.step}
              className={`flex flex-col rounded-2xl border p-7 shadow-sm ${
                s.primary ? "border-gold/40 bg-card ring-1 ring-gold/20" : "border-border bg-card"
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <s.icon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {s.step}
              </p>
              <h2 className="mt-1 text-xl">{s.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.body}</p>
              <a
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                download={"download" in s ? s.download : undefined}
                className={`mt-5 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                  s.primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-input bg-background text-foreground hover:bg-accent"
                }`}
              >
                {s.cta}
                <ArrowRight className="size-4" />
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Back to home
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
