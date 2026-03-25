import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Web Push Encryption (RFC 8291 / aes128gcm) ───

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

async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = concatUint8(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  return okm.slice(0, length);
}

function createInfo(
  type: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  const header = encoder.encode("Content-Encoding: ");
  const nul = new Uint8Array([0]);

  return concatUint8(
    header,
    typeBytes,
    nul,
    encoder.encode("P-256"),
    nul,
    new Uint8Array([0, 65]),
    clientPublicKey,
    new Uint8Array([0, 65]),
    serverPublicKey
  );
}

async function encryptPayload(
  payload: string,
  subscriptionPublicKey: string,
  subscriptionAuth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
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

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeys.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();

  // HKDF for IKM
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const ikm = await hkdfSha256(sharedSecret, authBytes, authInfo, 32);

  // Derive content encryption key
  const cekInfo = createInfo("aesgcm", clientPublicKeyBytes, serverPublicKeyRaw);
  const contentEncryptionKey = await hkdfSha256(ikm, salt, cekInfo, 16);

  // Derive nonce
  const nonceInfo = createInfo("nonce", clientPublicKeyBytes, serverPublicKeyRaw);
  const nonce = await hkdfSha256(ikm, salt, nonceInfo, 12);

  // Encrypt with AES-128-GCM
  const paddingLength = 0;
  const padding = new Uint8Array(2 + paddingLength);
  padding[0] = (paddingLength >> 8) & 0xff;
  padding[1] = paddingLength & 0xff;

  const payloadBytes = encoder.encode(payload);
  const plaintext = concatUint8(padding, payloadBytes);

  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      plaintext
    )
  );

  return { ciphertext: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

// ─── VAPID JWT ───

async function wrapRawToP8(raw32: Uint8Array): Promise<ArrayBuffer> {
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(prefix.length + 32);
  pkcs8.set(prefix);
  pkcs8.set(raw32, prefix.length);
  return pkcs8.buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let offset = 3;
  const rLen = der[offset]; offset++;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rDest);
  offset += rLen + 1;
  const sLen = der[offset]; offset++;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), sDest);
  return raw;
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const rawKey = base64UrlDecode(privateKeyBase64);
  const keyData = rawKey.length === 32 ? await wrapRawToP8(rawKey) : rawKey;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned))
  );

  const rawSig = sig.length === 64 ? sig : derToRaw(sig);
  return `${unsigned}.${base64UrlEncode(rawSig)}`;
}

// ─── Send Push ───

async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payloadStr,
    subscription.p256dh,
    subscription.auth
  );

  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);

  const body = concatUint8(
    // aes128gcm header
    salt,                                          // 16 bytes salt
    new Uint8Array(new Uint32Array([ciphertext.length + 16 + 1 + 65]).buffer).reverse(), // rs (record size) as 4 bytes big-endian
    new Uint8Array([65]),                           // key length
    serverPublicKey,                               // 65 bytes server public key
    ciphertext                                     // encrypted data
  );

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Crypto-Key": `dh=${base64UrlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      "Encryption": `salt=${base64UrlEncode(salt)}`,
      TTL: "86400",
      Authorization: `WebPush ${jwt}`,
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
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@budgetplanner.app";

    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, title, body, icon, data } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

        const responseText = await res.text();

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          expired.push(sub.id);
        } else {
          errors.push(`${res.status}: ${responseText}`);
          console.error(`Push failed for ${sub.endpoint}: ${res.status} ${responseText}`);
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
      JSON.stringify({ sent, expired: expired.length, total: subs.length, errors: errors.length > 0 ? errors : undefined }),
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
