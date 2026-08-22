import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { AuthUser } from "./auth";

export type ProfileUser = AuthUser & {
  savedViewCount: number;
  createdAt: string;
  updatedAt: string;
};

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: () =>
      api<{ user: ProfileUser }>("/profile").then((r) => r.user),
    staleTime: 30_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api<{ user: ProfileUser }>("/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.profile.me, data.user);
      qc.setQueryData(queryKeys.auth.me, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api<{ ok: boolean }>("/profile/password", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
