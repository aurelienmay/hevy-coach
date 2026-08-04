import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton width={140} height={22} style={{ marginBottom: 4 }} />
      <Skeleton width={320} height={13} style={{ marginTop: 8, marginBottom: 20 }} />

      <Skeleton width={160} height={18} style={{ marginBottom: 12 }} />
      <Skeleton height={60} radius={10} style={{ marginBottom: 16 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={160} radius={10} />
        ))}
      </div>

      <Skeleton width={160} height={18} style={{ marginBottom: 12 }} />
      <Skeleton width={280} height={34} radius={8} />
    </main>
  );
}
