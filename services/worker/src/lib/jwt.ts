export interface DeviceTokenPayload {
  type: "device";
  device_id: string;
  restaurant_id: string;
  exp?: number;
}

export interface SessionTokenPayload {
  type: "session";
  device_id: string;
  restaurant_id: string;
  staff_id: string;
  role: string;
  exp?: number;
}

type TokenPayload = DeviceTokenPayload | SessionTokenPayload;

const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours per spec

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(payload: TokenPayload, secret: string): Promise<string> {
  const withExp: TokenPayload =
    payload.type === "session"
      ? { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }
      : payload;
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64url(new TextEncoder().encode(JSON.stringify(withExp)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(sig)}`;
}

export async function verifyJwt<T extends TokenPayload>(token: string, secret: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(sig!),
    new TextEncoder().encode(`${header}.${body}`)
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body!))) as T & { exp?: number };
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
