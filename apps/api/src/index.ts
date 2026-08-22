import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { exploreRoutes } from "./routes/explore.js";
import { libraryRoutes } from "./routes/library.js";
import { adminRoutes } from "./routes/admin.js";
import { profileRoutes } from "./routes/profile.js";
import { electoralAssetsRoutes } from "./routes/electoral-assets.js";
import { globalSearchRoutes } from "./routes/global-search.js";
import { requireAuth, requireAdmin } from "./lib/middleware.js";

const app = new Hono();

const origin = process.env.WEB_ORIGIN || "http://localhost:5173";

app.use(
  "*",
  cors({
    origin,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) =>
  c.json({
    name: "BDCAT Analytics API",
    version: "0.1.0",
  }),
);

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/assets/electorals", electoralAssetsRoutes);

app.use("/explore/*", requireAuth);
app.route("/explore", exploreRoutes);

app.use("/global-search/*", requireAuth);
app.route("/global-search", globalSearchRoutes);

app.use("/library/*", requireAuth);
app.route("/library", libraryRoutes);

app.use("/profile", requireAuth);
app.use("/profile/*", requireAuth);
app.route("/profile", profileRoutes);

app.use("/admin", requireAuth);
app.use("/admin/*", requireAuth);
app.use("/admin", requireAdmin);
app.use("/admin/*", requireAdmin);
app.route("/admin", adminRoutes);

const port = Number(process.env.API_PORT || 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BDCAT API listening on http://localhost:${info.port}`);
});
