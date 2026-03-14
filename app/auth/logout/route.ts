import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { sanitizeReturnTo } from "../_lib/return-to";

export async function GET(req: NextRequest) {
  const domain = await resolveCognitoDomain();
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const logoutRedirect = await mustServerEnv("COGNITO_LOGOUT_REDIRECT_URI");

  if (!domain || !clientId || !logoutRedirect) {
    return new NextResponse("Missing server env vars", { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.delete("id_token");
  cookieStore.delete("access_token");
  const returnTo = sanitizeReturnTo(
    req.nextUrl.searchParams.get("returnTo"),
    logoutRedirect
  );
  const cookieBase = getAuthCookieBase();

  const logoutUrl =
    `${domain.replace(/\/$/, "")}/logout` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&logout_uri=${encodeURIComponent(returnTo)}`;

  const res = NextResponse.redirect(logoutUrl);
  res.cookies.set("id_token", "", { ...cookieBase, maxAge: 0 });
  res.cookies.set("access_token", "", { ...cookieBase, maxAge: 0 });
  return res;
}
