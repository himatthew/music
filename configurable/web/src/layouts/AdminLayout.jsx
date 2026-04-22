import { Layout, Menu } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Header, Content } = Layout;

export default function AdminLayout() {
  const loc = useLocation();
  const nav = useNavigate();

  const selected = loc.pathname.startsWith("/votes") ? "votes" : "votes";

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          paddingInline: 24,
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 4px rgba(0,21,41,.08)",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 700,
            marginRight: 32,
            letterSpacing: "0.02em",
          }}
        >
          实时投票
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, minWidth: 0, borderBottom: "none" }}
          items={[{ key: "votes", label: "投票会场", onClick: () => nav("/votes") }]}
        />
      </Header>
      <Content style={{ padding: 24 }}>
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            minHeight: 480,
            boxShadow: "0 1px 2px rgba(0,0,0,.03)",
          }}
        >
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
