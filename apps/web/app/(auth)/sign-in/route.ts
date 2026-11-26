import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const callbackURL = safeNext(new URL(request.url).searchParams.get("next"));
  const { url } = await auth.api.signInSocial({
    body: { callbackURL },
    headers: await headers(),
  });
  redirect(url!);
}
