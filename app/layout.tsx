import Sidebar from "@/components/Sidebar";
import "@/app/globals.css";

export const metadata = {
  title: "Hevy Coach Dashboard",
  description: "Working-sets-only training dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 32 }}>
          <Sidebar />
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
