"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categories, colors } from "@/lib/categories";
import type { NearbyResult } from "@/lib/types";

export default function CategoryChart({ result }: { result: NearbyResult }) {
  const data = result.categories.map(item => ({ ...item, name: categories.find(category => category.id === item.category)?.short ?? item.label }));
  return <div className="category-chart" role="img" aria-label={`Registros OSM por categoría: ${data.map(item => `${item.name} ${item.count}`).join(", ")}`}>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, left: 0, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={82} tick={{ fill: "#667574", fontSize: 11 }} />
        <Tooltip cursor={{ fill: "#f0f5f2" }} formatter={value => [value, "Registros OSM"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>
          {data.map(item => <Cell key={item.category} fill={colors[item.category]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

