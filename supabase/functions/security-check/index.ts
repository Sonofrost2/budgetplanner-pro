// Edge function: VPN/proxy/Tor detection + country mismatch logging.
// Uses ipapi.co (no key) plus heuristics on org/ASN. Service-role insert into security_signals.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IpInfo {
  ip?: string;
  country_code?: string;
  city?: string;
  org?: string;
  asn?: string;
}

const HOSTING_RE = /amazon|aws|google cloud|microsoft|azure|digitalocean|ovh|hetzner|linode|vultr|hosting|datacenter|cloudflare|leaseweb|choopa|colocation|m247|gcore|alibaba|tencent/i;
const VPN_RE = /vpn|nordvpn|expressvpn|surfshark|protonvpn|mullvad|cyberghost|private internet access|pia|ipvanish|hidemyass|tunnelbear|windscribe|hola|opera browser|psiphon/i;
const TOR_RE = /\btor\b|exit node|onion|relay/i;

async function fetchIpInfo(ip: string): Promise<IpInfo> {
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!r.ok) return {};
    return await r.json();
  } catch {
    return {};
  }
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Optional auth: identify user if token provided
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const declaredCountry: string | null = body.declaredCountry ?? null;
    const userAgent = req.headers.get('user-agent') || '';
    const ip = getClientIp(req);

    if (!ip) {
      return new Response(JSON.stringify({ ok: false, reason: 'no_ip' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const info = await fetchIpInfo(ip);
    const org = (info.org || '').trim();
    const isHosting = HOSTING_RE.test(org);
    const isVpn = VPN_RE.test(org);
    const isTor = TOR_RE.test(org);
    const isProxy = /proxy|squid|relay/i.test(org);
    const detectedCountry = info.country_code || null;
    const mismatch = !!(declaredCountry && detectedCountry && declaredCountry.toUpperCase() !== detectedCountry.toUpperCase());

    // Risk score 0-100
    let risk = 0;
    if (isVpn) risk += 60;
    if (isTor) risk += 80;
    if (isProxy) risk += 50;
    if (isHosting && !isVpn) risk += 30;
    if (mismatch) risk += 25;
    risk = Math.min(100, risk);

    const flags = { isVpn, isProxy, isTor, isHosting, mismatch, org, detectedCountry, declaredCountry };

    if (risk > 0 || mismatch) {
      let eventType = 'low_risk_signup';
      if (isTor) eventType = 'tor_detected';
      else if (isVpn) eventType = 'vpn_detected';
      else if (isProxy) eventType = 'proxy_detected';
      else if (mismatch) eventType = 'country_mismatch';
      else if (isHosting) eventType = 'hosting_detected';
      if (risk >= 70) eventType = 'high_risk_signup';

      await supabase.from('security_signals').insert({
        user_id: userId,
        event_type: eventType,
        ip_address: ip,
        detected_country: detectedCountry,
        declared_country: declaredCountry,
        risk_score: risk,
        is_vpn: isVpn,
        is_proxy: isProxy,
        is_tor: isTor,
        is_hosting: isHosting,
        user_agent: userAgent,
        metadata: { org, asn: info.asn ?? null, city: info.city ?? null, source: body.source ?? 'unknown' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      risk,
      blocked: risk >= 80,
      flags,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[security-check] error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});