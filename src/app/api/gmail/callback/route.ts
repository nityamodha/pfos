import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGmailRedirectUri, upsertGmailSourceFromCode } from "@/lib/gmail";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) redirect("/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get("pfos_gmail_oauth_state")?.value;
  store.delete("pfos_gmail_oauth_state");

  if (error) redirect(`/automation?gmail=error&reason=${encodeURIComponent(error)}`);
  if (!code || !state || !expectedState || state !== expectedState) {
    redirect("/automation?gmail=error&reason=invalid_state");
  }

  try {
    await upsertGmailSourceFromCode({
      code,
      redirectUri: getGmailRedirectUri(url.origin),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "connect_failed";
    redirect(`/automation?gmail=error&reason=${encodeURIComponent(reason)}`);
  }

  redirect("/automation?gmail=connected");
}
