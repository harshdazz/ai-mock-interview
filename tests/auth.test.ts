import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { AuthError, verifyFirebaseIdToken } from "../worker/auth.ts";

// Tokens signed with a local key pair, standing in for Google's securetoken
// keys, so every claim check can be exercised without a real sign-in.
const PROJECT = "demo-project";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;

const google = await generateKeyPair("RS256");
const attacker = await generateKeyPair("RS256");
const keys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(google.publicKey)), kid: "google-1", alg: "RS256" }],
});

const now = () => Math.floor(Date.now() / 1000);

type PrivateKey = typeof google.privateKey;

async function token({
  claims = {},
  key = google.privateKey,
  kid = "google-1",
  iat = now() - 60,
  exp = now() + 3000,
}: {
  claims?: Record<string, unknown>;
  key?: PrivateKey;
  kid?: string;
  iat?: number;
  exp?: number;
} = {}) {
  // Overrides go last: SignJWT's setIssuer() and friends would replace them.
  return new SignJWT({
    iss: ISSUER,
    aud: PROJECT,
    sub: "user-123",
    auth_time: now() - 120,
    iat,
    exp,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .sign(key);
}

const rejects = (jwt: Promise<string> | string) =>
  assert.rejects(async () => verifyFirebaseIdToken(await jwt, PROJECT, keys), AuthError);

test("accepts a well-formed token and returns the uid", async () => {
  assert.equal(await verifyFirebaseIdToken(await token(), PROJECT, keys), "user-123");
});

test("rejects a token for another Firebase project", async () => {
  await rejects(token({ claims: { aud: "someone-elses-project" } }));
});

test("rejects a token from another issuer", async () => {
  await rejects(token({ claims: { iss: "https://evil.example" } }));
});

test("rejects an expired token", async () => {
  await rejects(token({ iat: now() - 7200, exp: now() - 3600 }));
});

test("rejects a token issued in the future", async () => {
  await rejects(token({ iat: now() + 600 }));
});

test("rejects a token without auth_time", async () => {
  await rejects(token({ claims: { auth_time: undefined } }));
});

test("rejects an empty subject", async () => {
  await rejects(token({ claims: { sub: "" } }));
});

test("rejects a token signed by a key Google never published", async () => {
  await rejects(token({ key: attacker.privateKey }));
});

test("rejects an HS256 token, so the algorithm cannot be swapped", async () => {
  const forged = await new SignJWT({ auth_time: now() - 120 })
    .setProtectedHeader({ alg: "HS256", kid: "google-1" })
    .setIssuer(ISSUER)
    .setAudience(PROJECT)
    .setSubject("user-123")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("guessable-secret"));
  await rejects(forged);
});

test("rejects garbage", async () => {
  await rejects("not-a-jwt");
});
