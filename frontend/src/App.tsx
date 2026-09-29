import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./stores/auth";
import { useMe } from "./lib/queries";
import { Loading, Toaster } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Team from "./pages/Team";
import PlanPage from "./pages/Plan";
import EmployeeHome from "./pages/employee/Home";
import MyShifts from "./pages/employee/Shifts";
import AdminHome from "./pages/admin/Home";
import AdminShifts from "./pages/admin/Shifts";
import Report from "./pages/admin/Report";
import People from "./pages/admin/People";
import SettingsPage from "./pages/admin/Settings";

function Routed() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return <Loading />;
  const admin = me.user.role === "admin";
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={admin ? <AdminHome /> : <EmployeeHome />} />
        <Route path="shifts" element={admin ? <AdminShifts /> : <MyShifts />} />
        <Route path="team" element={<Team />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="profile" element={<Profile />} />
        {admin && (
          <>
            <Route path="report" element={<Report />} />
            <Route path="people" element={<People />} />
            <Route path="settings" element={<SettingsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const token = useAuth((s) => s.token);
  return (
    <BrowserRouter>
      <Toaster />
      {token ? <Routed /> : <Login />}
    </BrowserRouter>
  );
}
