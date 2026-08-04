import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Skeleton width={220} height={22} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={90} height={26} radius={6} />
        </div>
      </div>
      <Skeleton width={260} height={13} style={{ marginTop: 8, marginBottom: 20 }} />

      <Skeleton height={220} radius={10} />

      <Skeleton width={180} height={18} style={{ marginTop: 32, marginBottom: 12 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </div>
    </main>
  );
}
