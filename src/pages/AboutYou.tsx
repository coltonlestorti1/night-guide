/**
 * Onboarding step 2 — birthday and gender.
 *
 * Birthday is required; it is the field this step exists for. Gender is
 * optional and skippable. The 13+ check is a COPPA data floor, not a drinking
 * gate — ENDZ deliberately does not restrict by drinking age.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isUnderMinimum, MIN_AGE } from "@/lib/birthday";
import { savePrivateProfile, GENDERS, GENDER_LABELS, type Gender } from "@/lib/profilePrivate";
import { logEvent } from "@/lib/analytics";

const AboutYou = () => {
  const navigate = useNavigate();
  const { status, session } = useAuthStore();
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  const tooYoung = birthday !== "" && isUnderMinimum(birthday);
  const canSubmit = birthday !== "" && !tooYoung && !submitting;

  const submit = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await savePrivateProfile(session.user.id, birthday, gender);
      logEvent("onboarding_about_completed", { has_gender: gender !== null });
      navigate("/welcome/spots", { replace: true });
    } catch {
      setSubmitting(false);
      setError("Couldn't save that. Give it another shot.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 pt-24">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">A bit about you</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          So we can point you at the right rooms.
        </p>

        <label htmlFor="birthday" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Birthday
        </label>
        <Input
          id="birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="h-11 mt-1.5 text-base md:text-sm"
        />
        <p className={cn("text-xs mt-2 min-h-4", tooYoung ? "text-red-500" : "text-muted-foreground")}>
          {tooYoung ? `You need to be at least ${MIN_AGE} to use ENDZ.` : error}
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Gender <span className="normal-case font-normal">(optional)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? null : g)}
                aria-pressed={gender === g}
                className={cn(
                  "h-11 rounded-xl border text-sm transition-colors",
                  gender === g
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={submit} disabled={!canSubmit} className="w-full h-11 rounded-xl mt-5">
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
};

export default AboutYou;
