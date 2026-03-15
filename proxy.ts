import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

type ProxyAuthConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  clientId: string | null;
};

let cachedProxyAuthConfig: ProxyAuthConfig | null = null;
let missingProxyConfigWarned = false;

function getProxyAuthConfig(): ProxyAuthConfig | null {
  if (cachedProxyAuthConfig) return cachedProxyAuthConfig;

  const region = process.env.COGNITO_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID || null;
  if (!region || !userPoolId) {
    return null;
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  cachedProxyAuthConfig = { issuer, jwks, clientId };
  return cachedProxyAuthConfig;
}

async function isValidToken(token: string, config: ProxyAuthConfig): Promise<boolean> {
  try {
    await jwtVerify(token, config.jwks, {
      issuer: config.issuer,
      audience: config.clientId ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const protectedSurface =
    pathname.startsWith("/app") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/dashboard");

  if (!protectedSurface) {
    return NextResponse.next();
  }

  const isGuestProjectPage = pathname === "/app/projects/guest";
  const isGuestProjectApi = pathname.startsWith("/app/api/projects/guest/");
  if (isGuestProjectPage || isGuestProjectApi) {
    if (isGuestProjectPage && !req.cookies.get("guest_sid")?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/test";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isDevAuthBypassEnabled()) {
    return NextResponse.next();
  }

  const authConfig = getProxyAuthConfig();
  if (!authConfig) {
    if (process.env.NODE_ENV === "production") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth", "config_error");
      return NextResponse.redirect(url);
    }

    if (!missingProxyConfigWarned) {
      missingProxyConfigWarned = true;
      console.warn(
        "proxy_auth_config_missing: COGNITO_REGION/COGNITO_USER_POOL_ID not set in runtime env; skipping proxy auth check (dev only)"
      );
    }
    return NextResponse.next();
  }

  const token = req.cookies.get("id_token")?.value;

  if (!token || !(await isValidToken(token, authConfig))) {
    const currentTarget = req.nextUrl.clone();
    const loginUrl = new URL("/auth/login", currentTarget.origin);
    loginUrl.searchParams.set("returnTo", currentTarget.toString());
    const res = NextResponse.redirect(loginUrl);

    res.cookies.set("id_token", "", {
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("access_token", "", {
      path: "/",
      maxAge: 0,
    });

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/book/:path*", "/dashboard/:path*"],
};
