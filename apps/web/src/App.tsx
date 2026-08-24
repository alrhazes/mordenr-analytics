import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/features/auth/login-page";
import { ExplorePage } from "@/features/explore/explore-page";
import { LibraryPage } from "@/features/library/library-page";
import { AdminPage } from "@/features/admin/admin-page";
import { ProfilePage } from "@/features/profile/profile-page";
import { SimulationPage } from "@/features/simulation/simulation-page";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/explore" replace />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/explore" replace />} />
    </Routes>
  );
}
