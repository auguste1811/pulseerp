import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

async function main() {
  const [emailArg, passwordArg, firstNameArg, lastNameArg] =
    process.argv.slice(2);

  const email = emailArg?.trim().toLowerCase();
  const password = passwordArg || "";
  const firstName = firstNameArg?.trim() || "Administrateur";
  const lastName = lastNameArg?.trim() || "PulseERP";

  if (!email || password.length < 10) {
    throw new Error(
      [
        "Usage :",
        "npm run platform:create-admin -- email mot-de-passe prénom nom",
        "",
        "Le mot de passe doit contenir au moins 10 caractères.",
      ].join("\n"),
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      isActive: true,
      isPlatformAdmin: true,
      emailVerified: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      isActive: true,
      isPlatformAdmin: true,
      emailVerified: new Date(),
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      isPlatformAdmin: true,
    },
  });

  console.log("");
  console.log("Compte développeur prêt :");
  console.log(`${user.firstName} ${user.lastName} <${user.email}>`);
  console.log("Connexion : /developer/login");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
