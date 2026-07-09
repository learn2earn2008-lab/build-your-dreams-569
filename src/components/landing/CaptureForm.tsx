import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function CaptureForm({
  source = "landing_page",
  ctaLabel = "Send Me The Free Framework",
}: {
  source?: string;
  ctaLabel?: string;
}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          phone: values.phone || "",
          source,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setSubmitting(false);
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setSubmitting(false);
    navigate({ to: "/thank-you" });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5 text-left">
        <Label htmlFor={`${source}-name`} className="text-sm font-medium">
          Full name
        </Label>
        <Input id={`${source}-name`} placeholder="Jordan Carter" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5 text-left">
        <Label htmlFor={`${source}-email`} className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id={`${source}-email`}
          type="email"
          placeholder="you@business.com"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5 text-left">
        <Label htmlFor={`${source}-phone`} className="text-sm font-medium">
          Phone <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id={`${source}-phone`} type="tel" placeholder="(555) 123-4567" {...register("phone")} />
      </div>
      <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={submitting}>
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        We respect your privacy. Unsubscribe anytime.
      </p>
    </form>
  );
}
