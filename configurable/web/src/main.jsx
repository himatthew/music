import { App, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout.jsx";
import VotePage from "./VotePage.jsx";
import VoteDisplayPage from "./VoteDisplayPage.jsx";
import VoteSessionsPage from "./pages/VoteSessionsPage.jsx";
import "./theme.css";
import "./vote.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#00838f",
          borderRadius: 8,
        },
      }}
    >
      <App>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/votes" replace />} />
            <Route path="/vote/:sessionId" element={<VotePage />} />
            <Route path="/vote" element={<VotePage />} />
            <Route path="/vote-display/:sessionId" element={<VoteDisplayPage />} />
            <Route path="/vote-display" element={<VoteDisplayPage />} />
            <Route element={<AdminLayout />}>
              <Route path="/votes" element={<VoteSessionsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/votes" replace />} />
          </Routes>
        </BrowserRouter>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
