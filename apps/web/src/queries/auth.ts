import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "ANALYST" | "VIEWER";
};

export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const data = await api<{ user: AuthUser }>("/auth/me");
        return data.user;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.auth.me, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(queryKeys.auth.me, null);
    },
  });
}
