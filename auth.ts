import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      companyId: string;
      companyName: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    companyId?: string;
    companyName?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const providers: Provider[] = [
  Credentials({
    name: "Email et mot de passe",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      if (!user || !user.isActive || !user.passwordHash) return null;

      const valid = await bcrypt.compare(
        parsed.data.password,
        user.passwordHash,
      );

      if (!valid) return null;

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        id: user.id,
        email: user.email,
        name:
          user.name ||
          `${user.firstName} ${user.lastName}`.trim() ||
          user.email,
        image: user.image,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    },
  }),
];

const googleId =
  process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
  );
}

const microsoftId =
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID ||
  process.env.MICROSOFT_CLIENT_ID;
const microsoftSecret =
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ||
  process.env.MICROSOFT_CLIENT_SECRET;

if (microsoftId && microsoftSecret) {
  providers.push(
    MicrosoftEntraID({
      clientId: microsoftId,
      clientSecret: microsoftSecret,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

async function defaultMembership(userId: string) {
  return prisma.companyMember.findFirst({
    where: {
      userId,
      user: { isActive: true },
    },
    include: { company: true, user: true },
    orderBy: [{ role: "asc" }, { companyId: "asc" }],
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 12,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return false;

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true },
      });

      return storedUser?.isActive !== false;
    },

    async jwt({ token, user }) {
      const userId = user?.id || token.sub;
      if (!userId) return token;

      const membership = await defaultMembership(userId);

      token.sub = userId;
      token.companyId = membership?.companyId;
      token.companyName = membership?.company.name;
      token.role = membership?.role;
      token.firstName =
        membership?.user.firstName ||
        user?.firstName ||
        token.name?.split(" ")[0] ||
        "";
      token.lastName =
        membership?.user.lastName ||
        user?.lastName ||
        token.name?.split(" ").slice(1).join(" ") ||
        "";

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.companyId = token.companyId || "";
        session.user.companyName = token.companyName || "";
        session.user.role = token.role || "EMPLOYEE";
        session.user.firstName = token.firstName || "";
        session.user.lastName = token.lastName || "";
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;

      const existingMembership = await prisma.companyMember.findFirst({
        where: { userId: user.id },
      });

      if (existingMembership) return;

      const displayName = user.name?.trim() || "";
      const [firstName = "Utilisateur", ...lastParts] =
        displayName.split(/\s+/).filter(Boolean);
      const lastName = lastParts.join(" ");

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            firstName,
            lastName,
            name: displayName || user.email,
            emailVerified: new Date(),
          },
        });

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 3);

        const company = await tx.company.create({
          data: {
            id: randomUUID(),
            name: `Espace de ${firstName}`,
            subscription: {
              create: {
                plan: "TRIAL",
                status: "TRIALING",
                trialEndsAt,
              },
            },
          },
        });

        await tx.companyMember.create({
          data: {
            userId: user.id!,
            companyId: company.id,
            role: "OWNER",
          },
        });
      });
    },
  },
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET,
});
