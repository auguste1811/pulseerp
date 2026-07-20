import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const source =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;

  if (!source) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY ou JWT_SECRET doit être défini.",
    );
  }

  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Secret chiffré invalide.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
