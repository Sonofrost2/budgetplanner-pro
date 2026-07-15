import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ShieldAlert } from "lucide-react";

// Supabase Auth beta OAuth helpers — typed locally so we don't depend on the
// generated types keeping the `supabase.auth.oauth` namespace visible.
type OAuthResult = {
  data?: {
    client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
    redirect_url?: string | null;
    redirect_to?: string | null;
    scope?: string | null;
    requested_scopes?: string[] | null;
  } | null;
  error?: { message: string } | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Paramètre authorization_id manquant.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Le serveur d'autorisation n'a pas renvoyé d'URL de redirection.");
      return;
    }
    window.location.href = target;
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
        {children}
      </div>
    </main>
  );

  if (error) {
    return shell(
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
          <h1 className="text-xl font-bold font-display">Autorisation impossible</h1>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>Retour au tableau de bord</Button>
      </div>,
    );
  }

  if (!details) {
    return shell(
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement de la demande d'autorisation…
      </div>,
    );
  }

  const clientName = details.client?.name ?? "Cette application";
  const scopes = details.requested_scopes ?? (details.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  return shell(
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display leading-tight">Connecter {clientName} à Budget Planner Pro</h1>
          <p className="text-xs text-muted-foreground mt-1">{clientName} pourra utiliser les outils de cette application en votre nom.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm space-y-2">
        <p className="text-foreground">Cette application pourra :</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Lire vos comptes, transactions, catégories, budgets et objectifs d'épargne</li>
          <li>Enregistrer de nouvelles dépenses ou revenus en votre nom</li>
        </ul>
        <p className="text-xs text-muted-foreground pt-2">Les règles de sécurité (RLS) et vos permissions dans Budget Planner Pro s'appliquent toujours.</p>
        {scopes.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">Portées demandées : <code className="font-mono">{scopes.join(" ")}</code></p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Autoriser
        </Button>
        <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
          Refuser
        </Button>
      </div>
    </div>,
  );
}