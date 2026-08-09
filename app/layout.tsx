import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Hevy Coach Dashboard",
  description: "Working-sets-only training dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0b0d10",
          color: "#e6e6e6",
        }}
      >
        <style>{`
          @keyframes skeleton-pulse {
            0% { background-position: 100% 50%; }
            100% { background-position: 0 50%; }
          }
        `}</style>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 32 }}>
          <Sidebar />
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
