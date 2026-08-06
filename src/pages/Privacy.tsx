/**
 * /privacy — ENDZ Privacy Policy. Plain-English, written from verified app
 * behavior (analytics = ids only, raw location never leaves the device,
 * Google-only sign-in). Standalone page; no auth.
 */
import LegalLayout from "@/components/LegalLayout";
import { SUPPORT_EMAIL } from "@/lib/constants";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 6, 2026">
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
          <strong>Profile details you choose to add.</strong> Your display name,
          bio, and optionally your <strong>school and class year</strong>. These are
          entirely optional — you can skip them at sign-up, and add, change, or
          clear them at any time from Edit profile. If you add a school, it's shown
          on your profile to other signed-in people and is used to help you find
          others from your school.
        </li>
        <li>
          <strong>Your birthday.</strong> Asked once at sign-up and used to tailor
          what ENDZ recommends — different rooms suit different ages. It is stored
          apart from the rest of your profile, where <strong>only you can read
          it</strong>: it is never shown on your profile, never shown to friends,
          and never shown to anyone else. ENDZ does not check drinking age, and
          nothing here restricts you by it — but you must be at least 18 to have
          an account at all.
        </li>
        <li>
          <strong>Gender (optional).</strong> You can skip it and nothing changes
          except how well recommendations fit. It is kept in the same private place
          as your birthday, with the same rule — visible to you alone, never
          displayed to anyone.
        </li>
        <li>
          <strong>Your activity.</strong> When you check in to a venue, we store
          that check-in (the venue, the vibe you picked, and the time). When you
          add friends, we store those connections.
        </li>
        <li>
          <strong>Bars you ask us to add.</strong> If you search for somewhere ENDZ
          doesn't carry yet, we keep the place's name and its Google Maps id so we
          can tell you if we add it. That's the only reason it's stored.
        </li>
        <li>
          <strong>Your check-in history.</strong> Check-ins are kept after they
          end, so ENDZ can learn which places are actually busy when. Your
          friends only ever see where you are <strong>right now</strong> — once a
          check-in ends it's visible to you alone. Deleting your account deletes
          the whole history.
        </li>
        <li>
          <strong>Saved spots.</strong> Venues you bookmark are stored on our
          servers so they follow you between devices. Depending on your setting,
          your friends may see that you saved a place. You control this under
          Profile → Privacy → "Who sees your saves", and setting it to Nobody
          applies to spots you already saved, not just new ones. The spots you
          pick during sign-up are saved the same way and follow the same setting,
          which starts at friends.
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
          <strong>Delete your account, in the app.</strong> Profile → Account
          &amp; support → <strong>Delete my account</strong>. It happens
          immediately and can't be undone: it removes your profile, every
          check-in including your history, your saved spots, your friends and
          pending requests, and plans you created along with your RSVPs.
        </li>
        <li>
          <strong>Get a copy of your data.</strong> Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we'll send
          you what we hold.
        </li>
        <li>
          <strong>Report someone.</strong> Open their profile and tap{" "}
          <strong>Report</strong>. We review every report within 24 hours, and you
          can block them at the same time.
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
