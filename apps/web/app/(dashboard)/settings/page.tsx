import { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your WhatsApp connection and send preferences
        </p>
      </div>

      {/* WhatsApp Connection */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">WhatsApp Connection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your WhatsApp account via QR code (Baileys provider)
          </p>
        </div>
        <div className="p-5">
          <WhatsAppConnectionPanel />
        </div>
      </div>

      {/* Send rate limits info */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Rate Limits</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure via environment variables in your worker deployment
          </p>
        </div>
        <div className="p-5 space-y-3">
          <RateLimit label="Daily Cap" envVar="SEND_DAILY_CAP" description="Max new-contact messages per day" />
          <RateLimit label="Min Delay" envVar="SEND_DELAY_MIN_SEC" description="Minimum seconds between sends" />
          <RateLimit label="Max Delay" envVar="SEND_DELAY_MAX_SEC" description="Maximum seconds between sends" />
          <RateLimit label="Default Country Code" envVar="DEFAULT_COUNTRY_CODE" description="Used when phone numbers don't include a country code" />
        </div>
      </div>

      {/* Provider info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">WhatsApp Provider</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium">Current: <code className="text-primary text-xs">WHATSAPP_PROVIDER=mock</code></p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Mock mode — simulates sends without using a real WhatsApp account. Safe for development.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium">Switch to Baileys: <code className="text-amber-400 text-xs">WHATSAPP_PROVIDER=baileys</code></p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Uses your real WhatsApp number via Web session. Restart the worker, scan the QR code above.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RateLimit({
  label,
  envVar,
  description,
}: {
  label: string;
  envVar: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded shrink-0">{envVar}</code>
    </div>
  );
}

function WhatsAppConnectionPanel() {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-4">
        Set <code className="text-primary">WHATSAPP_PROVIDER=baileys</code> in your worker, restart the worker,
        and the QR code will appear in the worker logs. Scan it with your WhatsApp app.
      </p>
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-2 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
        Connection status updates automatically in the sidebar
      </div>
    </div>
  );
}
