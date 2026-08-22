const BASE =
  import.meta.env.VITE_ELECTORALS_ASSETS_BASE ?? "/api/assets/electorals";

export function electoralAssetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  return `${BASE.replace(/\/+$/, "")}/${clean}`;
}
