/**
 * /terms — ENDZ Terms of Service. Plain-English. Standalone page; no auth.
 */
import LegalLayout from "@/components/LegalLayout";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="July 17, 2026">
      <p>By using ENDZ, you agree to these terms. If you don't agree, don't use ENDZ.</p>

      <h3>Who can use ENDZ</h3>
      <p>
        You must be at least <strong>18</strong> years old and able to form a binding
        agreement. ENDZ shows nightlife venues and live activity; drink and act
        responsibly and follow all local laws.
      </p>

      <h3>Your account</h3>
      <p>
        You sign in with Google and pick a username. You're responsible for activity
        on your account. Don't impersonate others, harass anyone, or pick an offensive
        username. We can suspend accounts that abuse ENDZ or these terms.
      </p>

      <h3>Check-ins and content</h3>
      <p>
        Check-ins and vibe reports you post are your own. Keep them honest — don't
        spam, fake activity, or try to manipulate crowd counts. We may remove content
        or limit activity that degrades the experience for others.
      </p>

      <h3>What ENDZ is (and isn't)</h3>
      <p>
        ENDZ shows <strong>user-reported and estimated</strong> activity — crowd
        counts, vibes, happy hours, and hours pulled from public sources.{" "}
        <strong>We don't guarantee any of it is accurate or current.</strong> Venue
        hours, specials, and crowds change; confirm with the venue. ENDZ is provided
        "as is," without warranties, to the fullest extent the law allows.
      </p>

      <h3>Third-party venues and data</h3>
      <p>
        Venue names, hours, ratings, and details come from public sources (including
        Google) and may be wrong or out of date. Listing a venue is not an
        endorsement, partnership, or guarantee of entry, safety, or service.
      </p>

      <h3>Limitation of liability</h3>
      <p>
        To the fullest extent permitted by law, ENDZ is not liable for indirect,
        incidental, or consequential damages arising from your use of ENDZ, including
        anything that happens at a venue you found through ENDZ.
      </p>

      <h3>Changes and termination</h3>
      <p>
        We may update ENDZ or these terms. Continued use after changes means you
        accept them. We may suspend or end access for abuse or legal reasons. You can
        stop using ENDZ and delete your account at any time (see the Privacy Policy).
      </p>

      <h3>Governing law</h3>
      <p>
        These terms are governed by the laws of <strong>New York, USA</strong>,
        without regard to conflict-of-laws rules.
      </p>

      <h3>Contact</h3>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
