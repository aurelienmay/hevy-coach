export default function Skeleton({
  width = "100%",
  height = 14,
  radius = 4,
  style = {},
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, #14171b 25%, #1e2126 37%, #14171b 63%)",
        backgroundSize: "400% 100%",
        animation: "skeleton-pulse 1.4s ease infinite",
        ...style,
      }}
    />
  );
}
