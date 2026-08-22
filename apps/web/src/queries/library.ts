import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export type SavedViewConfig = {
  election: string;
  state: string;
  selectedConstituencyId?: string | null;
  mapMode?: "select" | "pan" | "compare";
  compareIds?: string[];
};

export type SavedView = {
  id: string;
  name: string;
  description: string | null;
  config: SavedViewConfig;
  createdAt: string;
  updatedAt: string;
};

export function useSavedViews() {
  return useQuery({
    queryKey: queryKeys.library.views,
    queryFn: () =>
      api<{ views: SavedView[] }>("/library/views").then((r) => r.views),
    staleTime: 15_000,
  });
}

export function useSavedView(id: string | null) {
  return useQuery({
    queryKey: queryKeys.library.view(id || ""),
    queryFn: () =>
      api<{ view: SavedView }>(`/library/views/${id}`).then((r) => r.view),
    enabled: Boolean(id),
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string | null;
      config: SavedViewConfig;
    }) =>
      api<{ view: SavedView }>("/library/views", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.library.views });
    },
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/library/views/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.library.views });
    },
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string | null;
      config?: SavedViewConfig;
    }) =>
      api<{ view: SavedView }>(`/library/views/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.library.views });
      void qc.invalidateQueries({ queryKey: queryKeys.library.view(vars.id) });
    },
  });
}
