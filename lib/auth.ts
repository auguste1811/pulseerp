import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

const SESSION_COOKIE = "pulse_session";
const GOOGLE_STATE_COOKIE = "pulse_google_state";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET est absent de l'environnement.");
  }
  return new TextEncoder().encode(value);
}

export type SessionPayload = {
  userId: string;
  companyId: string;
  email: string;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionSecret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const result = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
    });

    const payload = result.payload as Partial<SessionPayload>;
    if (!payload.userId || !payload.companyId || !payload.email) return null;

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
}

export async function currentContext() {
  const session = await requireSession();

  const rows = await query<any>(
    `
    SELECT
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email,
      c.id AS company_id,
      c.name AS company_name,
      cm.role
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    JOIN companies c ON c.id = cm.company_id
    WHERE u.id = $1
      AND c.id = $2
      AND u.is_active = TRUE
    LIMIT 1
    `,
    [session.userId, session.companyId],
  );

  if (!rows[0]) {
    await deleteSession();
    redirect("/login");
  }

  return rows[0];
}

export async function createGoogleState(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Buffer.from(bytes).toString("base64url");

  (await cookies()).set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return state;
}

export async function consumeGoogleState(receivedState: string): Promise<boolean> {
  const store = await cookies();
  const expectedState = store.get(GOOGLE_STATE_COOKIE)?.value;
  store.delete(GOOGLE_STATE_COOKIE);
  return Boolean(expectedState && receivedState && expectedState === receivedState);
}

export async function verifyGoogleIdToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID est absent.");

  const jwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
  );

  const result = await jwtVerify(idToken, jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const payload = result.payload;

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error("Le compte Google n'a pas pu être vérifié.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    firstName: typeof payload.given_name === "string" ? payload.given_name : "Utilisateur",
    lastName: typeof payload.family_name === "string" ? payload.family_name : "",
  };
}
