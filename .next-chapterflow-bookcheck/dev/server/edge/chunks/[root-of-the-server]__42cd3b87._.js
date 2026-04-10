(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__42cd3b87._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/app/app/_lib/dev-auth-bypass.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEV_BYPASS_USER",
    ()=>DEV_BYPASS_USER,
    "isDevAuthBypassEnabled",
    ()=>isDevAuthBypassEnabled
]);
function isDevAuthBypassEnabled() {
    return ("TURBOPACK compile-time value", "development") !== "production" && process.env.DEV_AUTH_BYPASS === "1";
}
const DEV_BYPASS_USER = {
    sub: "dev-local-user",
    email: "dev@localhost"
};
}),
"[project]/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/exports/index.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/_lib/dev-auth-bypass.ts [middleware-edge] (ecmascript)");
;
;
let missingConfigWarned = false;
function firstForwardedValue(value) {
    if (!value) return null;
    const first = value.split(",")[0]?.trim();
    return first || null;
}
function resolveRequestOrigin(req) {
    const forwardedHost = firstForwardedValue(req.headers.get("x-forwarded-host"));
    const host = forwardedHost || req.headers.get("host");
    const proto = firstForwardedValue(req.headers.get("x-forwarded-proto")) || (("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "http");
    if (host) {
        return `${proto}://${host}`;
    }
    return req.nextUrl.origin;
}
function middleware(req) {
    const { pathname } = req.nextUrl;
    const protectedSurface = pathname.startsWith("/app") || pathname.startsWith("/book") || pathname.startsWith("/dashboard");
    if (!protectedSurface) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // Dev bypass — allow all in development when enabled or Cognito not configured
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["isDevAuthBypassEnabled"])()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if (("TURBOPACK compile-time value", "development") !== "production" && (!process.env.COGNITO_REGION || !process.env.COGNITO_USER_POOL_ID)) {
        if (!missingConfigWarned) {
            missingConfigWarned = true;
            console.warn("middleware_auth_skip: COGNITO env vars not set in dev; skipping auth check");
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // Lightweight cookie-presence + expiry check. Full JWT verification
    // happens in requireUser() at the route/API level.
    const token = req.cookies.get("id_token")?.value;
    const expiresAt = Number(req.cookies.get("auth_expires_at")?.value);
    const isExpired = Number.isFinite(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000);
    if (!token || isExpired) {
        const publicOrigin = resolveRequestOrigin(req);
        const currentTarget = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, publicOrigin);
        const loginUrl = new URL("/auth/login", publicOrigin);
        loginUrl.searchParams.set("returnTo", currentTarget.toString());
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(loginUrl);
        // Clear any stale token fragments
        res.cookies.set("id_token", "", {
            path: "/",
            maxAge: 0
        });
        res.cookies.set("access_token", "", {
            path: "/",
            maxAge: 0
        });
        return res;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$exports$2f$index$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        "/app/:path*",
        "/book/:path*",
        "/dashboard/:path*"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__42cd3b87._.js.map