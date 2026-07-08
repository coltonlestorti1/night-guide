/**
 * /qr — a large, on-brand QR to show or print at the event. Points at
 * /join?source=qr on whatever origin this is deployed to. Outside AppLayout.
 */
import { QRCodeSVG } from "qrcode.react";

export default function Qr() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/join?source=qr`;

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-display font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">
        ENDZ
      </h1>
      <p className="mt-2 text-lg font-medium">Scan for early access</p>
      <p className="text-sm text-muted-foreground">The East Village nightlife map — launching soon.</p>

      {/* QR needs a light quiet-zone to scan reliably */}
      <div className="mt-8 rounded-3xl bg-white p-6 shadow-float">
        <QRCodeSVG value={url} size={260} level="M" marginSize={0} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground break-all text-center max-w-xs">{url}</p>
    </main>
  );
}
