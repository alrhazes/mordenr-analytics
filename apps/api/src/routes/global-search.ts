import { Hono } from "hono";
import { getGlobalSearchMeta, runGlobalSearch } from "../lib/global-search.js";

export const globalSearchRoutes = new Hono();

globalSearchRoutes.get("/meta", async (c) => {
  const meta = await getGlobalSearchMeta();
  return c.json(meta);
});

globalSearchRoutes.get("/", async (c) => {
  const q = c.req.query("q") || "";
  const limit = c.req.query("limit");
  const result = await runGlobalSearch(q, limit ? Number(limit) : undefined);
  return c.json(result);
});
