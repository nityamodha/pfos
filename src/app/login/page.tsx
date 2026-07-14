import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="icon-chip icon-chip-accent size-12 rounded-2xl">
            <span className="font-heading text-lg font-semibold">P</span>
          </span>
          <h1 className="font-heading text-lg font-semibold tracking-tight">PFOS</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
