"use client";

import {
  LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export type ChartPoint = { m: string; revenue: number; orders: number };

export function RevenueChart({ data = [] }: { data?: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="m"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 14,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--surface))",
            fontWeight: 600,
          }}
        />
        <Line type="monotone" dataKey="revenue" stroke="#212121" strokeWidth={3} dot={false} />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#C9CB6E"
          strokeWidth={3}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
