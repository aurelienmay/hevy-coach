import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton width={140} height={22} style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </div>
    </main>
  );
}
