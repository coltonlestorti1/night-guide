import { useState } from "react";
import { useConfigStore } from "@/store/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const { apiBaseUrl, mapboxToken, supabaseUrl, supabaseAnonKey, setConfig } = useConfigStore();
  const [api, setApi] = useState(apiBaseUrl ?? "");
  const [token, setToken] = useState(mapboxToken ?? "");
  const [sUrl, setSUrl] = useState(supabaseUrl ?? "");
  const [sAnon, setSAnon] = useState(supabaseAnonKey ?? "");

  const save = () => setConfig({ apiBaseUrl: api || undefined, mapboxToken: token || undefined, supabaseUrl: sUrl || undefined, supabaseAnonKey: sAnon || undefined });

  return (
    <section className="container pt-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Profile & Connections</h1>
        <p className="text-sm text-muted-foreground">Manage API keys and data sources</p>
      </header>
      <div className="grid gap-6 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">Public API Base URL</label>
          <Input placeholder="https://api.yourdomain.com" value={api} onChange={(e) => setApi(e.target.value)} />
          <p className="text-xs text-muted-foreground">Optional. If provided, the app will fetch venues from /venues endpoints.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mapbox Public Token</label>
          <Input placeholder="pk.***" value={token} onChange={(e) => setToken(e.target.value)} />
          <p className="text-xs text-muted-foreground">Required to enable the interactive map.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase URL</label>
          <Input placeholder="https://xyzcompany.supabase.co" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase Anon Key</label>
          <Input placeholder="eyJhbGci..." value={sAnon} onChange={(e) => setSAnon(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} className="">Save</Button>
          <a className="underline self-center" href="https://docs.lovable.dev/integrations/supabase/" target="_blank" rel="noreferrer">Connect Supabase</a>
        </div>
      </div>
    </section>
  );
};

export default Profile;
