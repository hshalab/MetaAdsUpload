import { auth } from "@/auth";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  const role = (session.user as unknown as Record<string, unknown>).role;
  if (role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}
