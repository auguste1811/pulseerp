import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "app/error.tsx",
  "app/global-error.tsx",
  "app/not-found.tsx",
  "app/(app)/loading.tsx",
  "app/api/health/runtime/route.ts",
  "prisma/schema.prisma",
  "package.json",
];

const missing = requiredFiles.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error("Fichiers de stabilité manquants :", missing.join(", "));
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

for (const command of ["typecheck", "check", "verify"]) {
  if (!packageJson.scripts?.[command]) {
    console.error(`Script npm manquant : ${command}`);
    process.exit(1);
  }
}

console.log("Contrôle structurel PulseERP : OK");
