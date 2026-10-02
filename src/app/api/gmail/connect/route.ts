import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildGmailAuthUrl, getGmailRedirectUri, newOAuthState } from "@/lib/gmail";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    redirect("/automation?gmail=error&reason=missing_google_oauth_env");
  }

  const origin = new URL(request.url).origin;
  const state = newOAuthState();
  const store = await cookies();
  store.set("pfos_gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  redirect(buildGmailAuthUrl({ state, redirectUri: getGmailRedirectUri(origin) }).toString());
}
