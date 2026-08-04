import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton width={140} height={22} style={{ marginBottom: 4 }} />
      <Skeleton width={340} height={13} style={{ marginTop: 8, marginBottom: 20 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
        <Skeleton height={38} radius={6} />
        <Skeleton height={38} radius={6} />
        <Skeleton height={38} radius={6} />
        <Skeleton width={120} height={34} radius={6} />
      </div>
    </main>
  );
}
