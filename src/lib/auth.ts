export const AUTH_COOKIE = "app_session";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionCookie(secret: string): Promise<string> {
  const ts = Date.now().toString();
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`v1:${ts}`),
  );
  return `${toBase64Url(new TextEncoder().encode(ts))}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionCookie(
  secret: string,
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) return false;
  const [tsPart, sigPart] = cookieValue.split(".");
  if (!tsPart || !sigPart) return false;
  let ts: string;
  try {
    ts = new TextDecoder().decode(fromBase64Url(tsPart));
  } catch {
    return false;
  }
  if (!/^\d+$/.test(ts)) return false;
  let sig: Uint8Array;
  try {
    sig = fromBase64Url(sigPart);
  } catch {
    return false;
  }
  const key = await importHmacKey(secret);
  const sigBuf = new ArrayBuffer(sig.byteLength);
  new Uint8Array(sigBuf).set(sig);
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBuf,
    new TextEncoder().encode(`v1:${ts}`),
  );
}
