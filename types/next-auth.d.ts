import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: { key: string; scope: "GLOBAL" | "LAB"; permissions: string[] };
      labId: string | null;
      inchargeOf: { labId: string }[];
      status?: string;
    };
  }
}
