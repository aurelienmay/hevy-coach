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
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
