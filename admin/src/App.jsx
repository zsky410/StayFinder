import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Places from "./pages/Places.jsx";
import Landmarks from "./pages/Landmarks.jsx";
import AiConfig from "./pages/AiConfig.jsx";
import Users from "./pages/Users.jsx";

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/places" element={<Places />} />
        <Route path="/landmarks" element={<Landmarks />} />
        <Route path="/ai-config" element={<AiConfig />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
