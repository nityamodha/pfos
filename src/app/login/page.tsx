import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span
            className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-cyan-400 text-white ring-1 ring-white/60"
            style={{
              boxShadow:
                "inset 0 1px 0 0 rgba(255,255,255,0.5), inset 0 -2px 3px 0 rgba(0,0,0,0.15), 0 8px 20px -6px var(--primary)",
            }}
          >
            <span className="text-lg font-semibold">P</span>
          </span>
          <h1 className="text-lg font-semibold tracking-tight">PFOS</h1>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
