import { SignJWT, jwtVerify } from "jose";

function stateSecret(): Uint8Array {
  const source = process.env.JWT_SECRET;
  if (!source) throw new Error("JWT_SECRET est absent.");
  return new TextEncoder().encode(source);
}

export async function createIntegrationState(
  companyId: string,
  userId: string,
  provider: string,
): Promise<string> {
  return new SignJWT({ companyId, userId, provider })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret());
}

export async function verifyIntegrationState(
  token: string,
  expectedProvider: string,
) {
  const result = await jwtVerify(token, stateSecret(), {
    algorithms: ["HS256"],
  });

  const payload = result.payload as {
    companyId?: string;
    userId?: string;
    provider?: string;
  };

  if (
    !payload.companyId ||
    !payload.userId ||
    payload.provider !== expectedProvider
  ) {
    throw new Error("État OAuth invalide.");
  }

  return {
    companyId: payload.companyId,
    userId: payload.userId,
  };
}
