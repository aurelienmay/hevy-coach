"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MUSCLE_COLORS, DEFAULT_MUSCLE_COLOR } from "@/lib/muscleColors";

type Row = { muscle: string; sets: number };

export default function VolumeChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        {/* recharts SVG props can't read CSS vars, so these literals mirror --border-default / --text-secondary */}
        <CartesianGrid strokeDasharray="3 3" stroke="#23262b" />
        <XAxis dataKey="muscle" stroke="#9a9a9a" fontSize={12} />
        <YAxis stroke="#9a9a9a" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "#1a1d21",
            border: "1px solid #333",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            fontSize: 13,
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Bar dataKey="sets" radius={[4, 4, 0, 0]}>
          {data.map((row, i) => (
            <Cell key={i} fill={MUSCLE_COLORS[row.muscle] ?? DEFAULT_MUSCLE_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
