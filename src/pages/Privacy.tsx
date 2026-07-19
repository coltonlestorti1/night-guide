/**
 * /privacy — ENDZ Privacy Policy. Plain-English, written from verified app
 * behavior (analytics = ids only, raw location never leaves the device,
 * Google-only sign-in). Standalone page; no auth.
 */
import LegalLayout from "@/components/LegalLayout";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 17, 2026">
      <p>
        ENDZ ("we", "us") runs a live nightlife map. This policy explains, in
        plain terms, what we collect and why. We built ENDZ on one rule:{" "}
        <strong>no covert tracking — everything is opt-in and you can see what
        you share.</strong>
      </p>

      <h3>What we collect</h3>
      <ul>
        <li>
          <strong>Account info.</strong> You sign in with Google. We receive your
          email address and basic Google profile (name, profile picture). We never
          see or store your Google password. You also choose a <strong>username</strong>{" "}
          shown to friends.
        </li>
        <li>
          <strong>Your activity.</strong> When you check in to a venue, we store
          that check-in (the venue, the vibe you picked, and the time). When you
          add friends, we store those connections.
        </li>
        <li>
          <strong>Location — only on your device.</strong> If you turn on location,
          your coordinates are used <strong>on your device</strong> to show distance
          and sort nearby spots. <strong>Your coordinates are never sent to our
          servers.</strong> The only way a place is linked to you is a check-in you
          tap yourself.
        </li>
        <li>
          <strong>Usage analytics.</strong> We log basic events (which venues get
          opened, check-ins, vibe changes, directions taps) to understand what's
          useful. These records contain a device identifier, your account id when
          you're signed in, the event name, and a venue id — <strong>never your
          name, email, phone, or raw location.</strong>
        </li>
        <li>
          <strong>Waitlist.</strong> If you signed up at an ENDZ event or link, we
          kept the name and phone/email you gave so we could tell you when we launch.
        </li>
        <li>
          <strong>"Out tonight" (opt-in).</strong> When you turn on Out tonight,
          ENDZ records which venues you're near that night — a venue id and coarse
          distance, never your raw coordinates — to understand where people go. It's
          never shown to your friends, it's off by default, and you can turn it off
          anytime.
        </li>
      </ul>

      <h3>What we do NOT do</h3>
      <ul>
        <li>We do <strong>not</strong> track your location in the background or when the app is closed.</li>
        <li>We do <strong>not</strong> sell your data.</li>
        <li>
          We do <strong>not</strong> show other users your identity in public crowd
          counts — those are anonymous totals ("12 here now"), not name lists.
        </li>
      </ul>

      <h3>Who else is involved</h3>
      <p>
        We use trusted providers to run ENDZ: <strong>Supabase</strong> (database
        and sign-in), <strong>Google</strong> (sign-in), <strong>Vercel</strong>{" "}
        (hosting), and <strong>OpenFreeMap</strong> (map tiles; your device requests
        map imagery from them, which involves your IP address as with any online
        map). Each handles data under its own policy.
      </p>

      <h3>Ghost mode</h3>
      <p>
        You can turn on <strong>ghost mode</strong> to keep your check-ins from being
        shared with friends. Anonymous crowd counts and our own usage analytics are
        unaffected.
      </p>

      <h3>Your choices and rights</h3>
      <ul>
        <li>
          <strong>See or delete your data.</strong> Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to request a
          copy of your data or to delete your account. Deleting your account removes
          your profile, check-ins, and friendships.
        </li>
        <li>
          <strong>Location.</strong> You can revoke location access any time in your
          browser or OS.
        </li>
        <li>
          Depending on where you live (e.g. EU/UK GDPR, California CCPA), you may
          have additional rights to access, correct, or delete your data — the email
          above is how you exercise them.
        </li>
      </ul>

      <h3>Children</h3>
      <p>
        ENDZ is for adults aged <strong>18+</strong>. We don't knowingly collect data
        from anyone under that age.
      </p>

      <h3>Changes</h3>
      <p>We'll update this page and the "Last updated" date when things change materially.</p>

      <h3>Contact</h3>
      <p>
        Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalLayout>
  );
}
