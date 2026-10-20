import { describe, it, expect } from "vitest";
import { createSessionCookie, verifySessionCookie } from "./auth";

const SECRET_A = "a".repeat(48);
const SECRET_B = "b".repeat(48);

describe("session cookie", () => {
  it("round-trips a freshly minted cookie", async () => {
    const cookie = await createSessionCookie(SECRET_A);
    expect(await verifySessionCookie(SECRET_A, cookie)).toBe(true);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await createSessionCookie(SECRET_A);
    expect(await verifySessionCookie(SECRET_B, cookie)).toBe(false);
  });

  it("rejects a missing cookie", async () => {
    expect(await verifySessionCookie(SECRET_A, undefined)).toBe(false);
    expect(await verifySessionCookie(SECRET_A, "")).toBe(false);
  });

  it("rejects a malformed cookie (no dot separator)", async () => {
    expect(await verifySessionCookie(SECRET_A, "notacookie")).toBe(false);
  });

  it("rejects a cookie with a tampered timestamp", async () => {
    const cookie = await createSessionCookie(SECRET_A);
    const [, sig] = cookie.split(".");
    // Encode a different timestamp but keep the original signature.
    const forgedTs = btoa("9999999999999").replace(/=+$/, "");
    expect(await verifySessionCookie(SECRET_A, `${forgedTs}.${sig}`)).toBe(false);
  });

  it("rejects a cookie with a tampered signature", async () => {
    const cookie = await createSessionCookie(SECRET_A);
    const [ts, sig] = cookie.split(".");
    const flipped = sig.replace(/^./, (c) => (c === "A" ? "B" : "A"));
    expect(await verifySessionCookie(SECRET_A, `${ts}.${flipped}`)).toBe(false);
  });

  it("rejects a non-numeric timestamp payload", async () => {
    const cookie = await createSessionCookie(SECRET_A);
    const [, sig] = cookie.split(".");
    const badTs = btoa("not-a-number").replace(/=+$/, "");
    expect(await verifySessionCookie(SECRET_A, `${badTs}.${sig}`)).toBe(false);
  });

  it("produces different cookies on subsequent mints (timestamp differs)", async () => {
    const a = await createSessionCookie(SECRET_A);
    await new Promise((r) => setTimeout(r, 2));
    const b = await createSessionCookie(SECRET_A);
    expect(a).not.toBe(b);
  });
});
