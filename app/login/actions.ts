"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}

export async function signInGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInMicrosoft() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

export async function signInGitHub() {
  await signIn("github", { redirectTo: "/dashboard" });
}
