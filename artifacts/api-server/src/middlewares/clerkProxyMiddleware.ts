/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import type { IncomingHttpHeaders } from "http";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 * In the multi-value case, the leftmost value is the original client-
 * facing host. Take that one in all forms. Exported so that app.ts
 * (clerkMiddleware callback) and this proxy middleware agree on which
 * hostname is canonical — otherwise multi-domain/custom-domain flows
 * break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(",")[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

/**
 * Decode the registered proxy URL from a pk_proxy_ publishable key.
 * Clerk embeds the registered proxy domain in the key itself as base64.
 * Using this as Clerk-Proxy-Url allows our custom proxy path to work
 * even though it differs from the domain embedded in the key.
 */
function getRegisteredProxyUrl(): string | undefined {
  const key = process.env.CLERK_PUBLISHABLE_KEY || "";
  if (!key.startsWith("pk_proxy_")) return undefined;
  try {
    const b64 = key.slice("pk_proxy_".length);
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    // Format: "https://domain.com$" — trim the trailing $
    return decoded.replace(/\$+$/, "").trim();
  } catch {
    return undefined;
  }
}

export function clerkProxyMiddleware(): RequestHandler {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  // The URL Clerk has registered for this app (decoded from the publishable key).
  // We send this as Clerk-Proxy-Url so Clerk's API accepts our requests even
  // though the browser connects through a different path on our server.
  // For pk_test_ (dev) keys, registeredProxyUrl will be undefined and we skip
  // the Clerk-Proxy-Url header so Clerk accepts the request anyway.
  const registeredProxyUrl = getRegisteredProxyUrl();

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = getClerkProxyHost(req) || "";
        const incomingProxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        // Only set Clerk-Proxy-Url for proxy/live keys (pk_proxy_ / pk_live_).
        // For dev (pk_test_) keys, omitting the header lets Clerk accept
        // the request as a direct frontend-api hit, which is fine for dev.
        const clerkProxyUrl = registeredProxyUrl ?? incomingProxyUrl;
        const pubKey = process.env.CLERK_PUBLISHABLE_KEY || "";
        if (!pubKey.startsWith("pk_test_")) {
          proxyReq.setHeader("Clerk-Proxy-Url", clerkProxyUrl);
        }
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
    },
  }) as RequestHandler;
}
