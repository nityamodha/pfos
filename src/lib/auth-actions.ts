"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/auth";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) throw new Error("Enter a username and password");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid username or password");
  }

  await createSession(user.id);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
