import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/auth-debug", (req, res) => {
  const auth = getAuth(req);
  const authHeader = req.headers["authorization"] ?? null;
  res.json({
    isAuthenticated: !!auth.userId,
    userId: auth.userId ?? null,
    clerkAuthStatus: req.headers["x-clerk-auth-status"] ?? null,
    clerkAuthReason: req.headers["x-clerk-auth-reason"] ?? null,
    hasAuthorizationHeader: !!authHeader,
    authorizationHeaderPrefix: authHeader ? authHeader.slice(0, 30) + "..." : null,
    hasSessionCookie: !!(req.headers["cookie"] ?? "").includes("__session"),
    publishableKeyConfigured: !!process.env.CLERK_PUBLISHABLE_KEY,
    secretKeyConfigured: !!process.env.CLERK_SECRET_KEY,
    publishableKeyPrefix: process.env.CLERK_PUBLISHABLE_KEY?.slice(0, 15) ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
});

export default router;
