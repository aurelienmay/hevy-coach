import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main>
      <Skeleton width={140} height={22} style={{ marginBottom: 4 }} />
      <Skeleton width={420} height={13} style={{ marginTop: 8, marginBottom: 8 }} />
      <Skeleton width={340} height={13} style={{ marginBottom: 20 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton height={100} radius={10} />
        <Skeleton height={100} radius={10} />
        <Skeleton height={100} radius={10} />
      </div>
    </main>
  );
}
