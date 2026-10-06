import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./lib/prisma";

interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
  role: { key: string; scope: "GLOBAL" | "LAB"; permissions: string[] };
  labId: string | null;
  inchargeOf: { labId: string }[];
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Note: Auth.js v5 supports the Credentials provider only with the JWT
  // session strategy. Role/permission data rides in the token; requireUser()
  // re-checks ACTIVE status against the DB on every request so deactivating
  // a user ends their access immediately.
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { role: true, inchargeOf: true },
        });
        if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;
        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        const authed: AuthorizedUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: {
            key: user.role.key,
            scope: user.role.scope,
            permissions: user.role.permissions,
          },
          labId: user.labId,
          inchargeOf: user.inchargeOf.map((l) => ({ labId: l.labId })),
        };
        return authed;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as AuthorizedUser;
        token.role = u.role;
        token.labId = u.labId;
        token.inchargeOf = u.inchargeOf;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role as {
        key: string;
        scope: "GLOBAL" | "LAB";
        permissions: string[];
      };
      session.user.labId = (token.labId as string | null) ?? null;
      session.user.inchargeOf = (token.inchargeOf as { labId: string }[]) ?? [];
      return session;
    },
  },
});
