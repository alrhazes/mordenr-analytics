import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { electoralAssetsRoot } from "../lib/electoral-media.js";

export const electoralAssetsRoutes = new Hono();

function relativeAssetPath(requestPath: string): string {
  let path = requestPath;
  if (path.startsWith("/assets/electorals")) {
    path = path.slice("/assets/electorals".length);
  }
  return path.replace(/^\/+/, "");
}

electoralAssetsRoutes.use(
  "/*",
  serveStatic({
    root: electoralAssetsRoot(),
    // c.req.path is absolute (/parties/foo.png). path.join(root, "/foo")
    // drops root on Node — rewrite to a relative segment first.
    rewriteRequestPath: relativeAssetPath,
  }),
);
