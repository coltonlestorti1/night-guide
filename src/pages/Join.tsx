/**
 * /join — public early-access waitlist. Rendered OUTSIDE AppLayout (no map,
 * no bottom tabs, no auth). This is the page the event QR points at.
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Users, Wine, Tag } from "lucide-react";
import { joinWaitlist, isEmail, isPhone } from "@/lib/waitlist";
import { logEvent } from "@/lib/analytics";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().min(1, "Enter your email").refine(isEmail, "Enter a valid email"),
  phone: z.string().trim().min(1, "Enter your phone").refine(isPhone, "Enter a valid phone"),
});
type FormValues = { name: string; email: string; phone: string };

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const source = params.get("source") || "link";
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    logEvent("waitlist_view", { source });
  }, [source]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await joinWaitlist({
        name: values.name,
        email: values.email,
        phone: values.phone,
        source,
      });
      logEvent("join_submit", { source });
      // Drop them straight into the map to explore (browsable signed-out).
      toast.success("You're on the list — welcome to ENDZ 🌙");
      navigate("/");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  };

  return (
    <main className="relative min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute -top-1/3 left-1/2 -translate-x-1/2 h-[60vh] w-[60vh] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm mx-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <MapPin className="h-3.5 w-3.5 text-primary" /> East Village, NYC
        </div>

        <h1 className="text-5xl font-display font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">
          ENDZ
        </h1>

        <p className="mt-3 text-lg leading-snug">
              The live map for where the night's actually happening.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Launching soon — get in before everyone else.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: Users, label: "Live crowds" },
                { icon: Wine, label: "Happy hours" },
                { icon: Tag, label: "Drink specials" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-foreground/90"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-3" noValidate>
              <div>
                <Input
                  {...register("name")}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-12 rounded-xl bg-card/80 backdrop-blur-xl border-border/60 transition-shadow focus-visible:shadow-glow focus-visible:border-primary/50"
                  aria-label="Your name"
                />
                {errors.name && <p className="text-xs text-destructive mt-1.5 px-1">{errors.name.message}</p>}
              </div>
              <div>
                <Input
                  {...register("email")}
                  placeholder="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-12 rounded-xl bg-card/80 backdrop-blur-xl border-border/60 transition-shadow focus-visible:shadow-glow focus-visible:border-primary/50"
                  aria-label="Email"
                />
                {errors.email && <p className="text-xs text-destructive mt-1.5 px-1">{errors.email.message}</p>}
              </div>
              <div>
                <Input
                  {...register("phone")}
                  placeholder="Phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-12 rounded-xl bg-card/80 backdrop-blur-xl border-border/60 transition-shadow focus-visible:shadow-glow focus-visible:border-primary/50"
                  aria-label="Phone number"
                />
                {errors.phone && <p className="text-xs text-destructive mt-1.5 px-1">{errors.phone.message}</p>}
              </div>

              {submitError && <p className="text-xs text-destructive px-1">{submitError}</p>}

              <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl text-base font-semibold shadow-glow">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Get early access"}
              </Button>
            </form>

            <p className="mt-4 text-[11px] text-muted-foreground/80 text-center">
              No spam. We'll only message you about the ENDZ launch.
            </p>

        <div className="mt-8 text-center text-[11px] text-muted-foreground/70">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="mx-1.5">·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </div>
    </main>
  );
}
