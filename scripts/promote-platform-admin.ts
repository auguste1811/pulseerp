import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      "Usage : npm run platform:promote -- votre@email.fr",
    );
  }

  const user = await prisma.user.update({
    where: { email },
    data: { isPlatformAdmin: true },
    select: { email: true, firstName: true, lastName: true },
  });

  console.log(
    `Super administrateur activé : ${user.firstName} ${user.lastName} <${user.email}>`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
