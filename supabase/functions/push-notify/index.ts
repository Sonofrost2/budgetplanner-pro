import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Utility functions ───

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ─── HMAC-SHA256 helper ───

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.length ? key : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, data));
}

// ─── HKDF-SHA256 ───

async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt.length ? salt : new Uint8Array(32), ikm);
  const infoWithCounter = concatUint8(info, new Uint8Array([1]));
  const okm = await hmacSha256(prk, infoWithCounter);
  return okm.slice(0, length);
}

// ─── Web Push Encryption (aes128gcm — RFC 8291) ───

async function encryptPayload(
  payload: string,
  subscriptionPublicKey: string,
  subscriptionAuth: string
): Promise<{
  ciphertext: Uint8Array;
  salt: Uint8Array;
  serverPublicKey: Uint8Array;
}> {
  const clientPublicKeyBytes = base64UrlDecode(subscriptionPublicKey);
  const authBytes = base64UrlDecode(subscriptionAuth);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeys.privateKey,
      256
    )
  );

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();

  // RFC 8291: IKM = HKDF(sharedSecret, auth, "WebPush: info" || 0x00 || client_pub || server_pub, 32)
  const keyInfoInput = concatUint8(
    encoder.encode("WebPush: info\0"),
    clientPublicKeyBytes,
    serverPublicKeyRaw
  );
  const ikm = await hkdfSha256(sharedSecret, authBytes, keyInfoInput, 32);

  // Content encryption key: HKDF(ikm, salt, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const contentEncryptionKey = await hkdfSha256(ikm, salt, cekInfo, 16);

  // Nonce: HKDF(ikm, salt, "Content-Encoding: nonce\0", 12)
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonce = await hkdfSha256(ikm, salt, nonceInfo, 12);

  // aes128gcm record: payload + delimiter (0x02) 
  const payloadBytes = encoder.encode(payload);
  const plaintext = concatUint8(payloadBytes, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  );

  // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
  const rs = new Uint8Array(4);
  const dv = new DataView(rs.buffer);
  dv.setUint32(0, 4096); // record size

  const header = concatUint8(
    salt,
    rs,
    new Uint8Array([serverPublicKeyRaw.length]),
    serverPublicKeyRaw
  );

  return {
    ciphertext: concatUint8(header, encrypted),
    salt,
    serverPublicKey: serverPublicKeyRaw,
  };
}

// ─── VAPID JWT (ES256) ───

async function importVapidPrivateKey(privateKeyBase64: string, publicKeyBase64: string): Promise<CryptoKey> {
  const rawPrivate = base64UrlDecode(privateKeyBase64);
  const rawPublic = base64UrlDecode(publicKeyBase64);
  
  console.log(`VAPID key lengths: private=${rawPrivate.length}, public=${rawPublic.length}`);
  
  if (rawPrivate.length !== 32) {
    throw new Error(`Invalid VAPID private key length: ${rawPrivate.length} (expected 32)`);
  }

  // Use JWK import which is most reliable across Deno versions
  // Extract x and y from the uncompressed public key (0x04 || x || y)
  const x = base64UrlEncode(rawPublic.slice(1, 33));
  const y = base64UrlEncode(rawPublic.slice(33, 65));
  const d = base64UrlEncode(rawPrivate);
  
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
    ext: true,
  };

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const key = await importVapidPrivateKey(privateKeyBase64);

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(unsigned)
    )
  );

  // ECDSA signature: Deno returns DER format, convert to raw r||s (64 bytes)
  let rawSig: Uint8Array;
  if (signature.length === 64) {
    rawSig = signature;
  } else {
    // Parse DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
    rawSig = new Uint8Array(64);
    let offset = 2; // skip 0x30 <total_len>
    // r
    offset++; // skip 0x02
    const rLen = signature[offset++];
    const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
    const rDest = rLen < 32 ? 32 - rLen : 0;
    rawSig.set(signature.slice(rStart, rStart + Math.min(rLen, 32)), rDest);
    offset += rLen;
    // s
    offset++; // skip 0x02
    const sLen = signature[offset++];
    const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
    const sDest = sLen < 32 ? 64 - sLen : 32;
    rawSig.set(signature.slice(sStart, sStart + Math.min(sLen, 32)), sDest);
  }

  return `${unsigned}.${base64UrlEncode(rawSig)}`;
}

// ─── Send Push ───

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  const { ciphertext } = await encryptPayload(
    payloadStr,
    subscription.p256dh,
    subscription.auth
  );

  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      Urgency: "normal",
    },
    body: ciphertext,
  });

  return res;
}

// ─── Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:contact@budgetplanner.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, title, body, icon, data } = await req.json();

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data || {},
      timestamp: Date.now(),
    });

    let sent = 0;
    const expired: string[] = [];
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        const res = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          expired.push(sub.id);
        } else {
          const responseText = await res.text();
          errors.push(`${res.status}: ${responseText}`);
          console.error(
            `Push failed for ${sub.endpoint}: ${res.status} ${responseText}`
          );
        }
      } catch (e) {
        errors.push(e.message);
        console.error("Push send error:", e);
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return new Response(
      JSON.stringify({
        sent,
        expired: expired.length,
        total: subs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Push notify error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
