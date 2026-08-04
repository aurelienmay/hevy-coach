"use client";

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = { muscle: string; sets: number };

const COLORS: Record<string, string> = {
  back: "#4f8ef7",
  shoulders: "#f7b84f",
  biceps: "#68d391",
  triceps: "#63b3ed",
  chest: "#f56565",
  quads: "#b794f4",
  hamstrings: "#ed8936",
  calves: "#a0aec0",
  glutes: "#f687b3",
  forearms: "#718096",
  abs: "#4fd1c5",
  lower_back: "#ecc94b",
};

export default function VolumeChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
        <XAxis dataKey="muscle" stroke="#888" fontSize={12} />
        <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#1a1d21", border: "1px solid #333", fontSize: 13 }}
          labelStyle={{ color: "#fff" }}
        />
        <Bar dataKey="sets" radius={[4, 4, 0, 0]}>
          {data.map((row, i) => (
            <Cell key={i} fill={COLORS[row.muscle] ?? "#999"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
