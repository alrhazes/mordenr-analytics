import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { AuthUser } from "./auth";

export type AdminUser = AuthUser & {
  savedViewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Role = AuthUser["role"];

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: () =>
      api<{ users: AdminUser[] }>("/admin/users").then((r) => r.users),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      name: string;
      password: string;
      role: Role;
    }) =>
      api<{ user: AdminUser }>("/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.users });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      role?: Role;
      password?: string;
    }) =>
      api<{ user: AdminUser }>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.users });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.users });
    },
  });
}
