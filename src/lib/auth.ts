import { cookies } from "next/headers";
import { prisma } from "./prisma";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "v3-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(user: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionData = JSON.stringify(user);
  const cookieStore = await cookies();
  cookieStore.set("session", sessionData, {
    httpOnly: true,
    path: "/",
    maxAge: 86400,
    sameSite: "lax",
  });
  return sessionId;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");
  if (!session) return null;
  try {
    return JSON.parse(session.value) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

export async function authenticateUser(username: string, password: string) {
  const hashed = await hashPassword(password);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.password !== hashed) return null;
  if (!user.active) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", { httpOnly: true, path: "/", maxAge: 0 });
}
