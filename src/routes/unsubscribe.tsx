import { useEffect, useState } from "react";
import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { Loader2, CheckCircle2, MailX, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

type Status = "loading" | "valid" | "already" | "invalid" | "done" | "submitting";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: `Unsubscribe — ${siteConfig.brand}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        if (active) setStatus("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const confirm = async () => {
    setStatus("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.reason === "already_unsubscribed")) {
        setStatus("done");
      } else {
        setStatus("invalid");
      }
    } catch {
      setStatus("invalid");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-5 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-gold" />
            <p>Checking your link…</p>
          </div>
        )}

        {status === "valid" && (
          <>
            <MailX className="mx-auto size-10 text-navy" />
            <h1 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              Unsubscribe from emails?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You'll stop receiving emails from {siteConfig.brand}. You can resubscribe anytime by
              opting in again.
            </p>
            <Button onClick={confirm} size="lg" className="mt-6 w-full font-semibold">
              Confirm Unsubscribe
            </Button>
          </>
        )}

        {status === "submitting" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-gold" />
            <p>Processing…</p>
          </div>
        )}

        {(status === "done" || status === "already") && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-gold" />
            <h1 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              {status === "already" ? "Already unsubscribed" : "You're unsubscribed"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won't receive any further emails from {siteConfig.brand}.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">Return home</Link>
            </Button>
          </>
        )}

        {status === "invalid" && (
          <>
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              Invalid or expired link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This unsubscribe link is no longer valid. If you keep receiving unwanted emails,
              contact us at {siteConfig.supportEmail}.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/">Return home</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
