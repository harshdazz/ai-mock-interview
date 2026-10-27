import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Firebase signs ID tokens with Google's rotating "securetoken" keys. jose
 * fetches this set lazily, caches it per isolate and refetches when it sees a
 * key id it does not know, which is how rotation is meant to be handled.
 */
const FIREBASE_KEYS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Verifies a Firebase Auth ID token and returns the user's uid.
 *
 * These are the checks Firebase documents for verifying a token without the
 * Admin SDK: RS256 only, a valid signature from Google's key set, `aud` equal
 * to the project id, `iss` equal to securetoken.google.com/<project>, not
 * expired, issued and authenticated in the past, and a non-empty `sub` of at
 * most 128 characters. Skipping any one of them turns the worker back into an
 * open proxy, so each is enforced here rather than assumed.
 *
 * `keys` exists for tests, which sign tokens with a local key pair.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey = FIREBASE_KEYS
): Promise<string> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      // Firebase ID tokens live for an hour. Setting this also makes jose
      // require `iat` and reject one in the future.
      maxTokenAge: "1h",
      clockTolerance: 5,
    }));
  } catch (error) {
    throw new AuthError(error instanceof Error ? error.message : "Invalid token");
  }

  const { sub, auth_time: authTime } = payload;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) {
    throw new AuthError("Token has no valid subject");
  }
  if (typeof authTime !== "number" || authTime > Date.now() / 1000 + 5) {
    throw new AuthError("Token auth_time is missing or in the future");
  }
  return sub;
}
