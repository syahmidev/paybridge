"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { STATUS_LABEL, formatMoney } from "@/lib/format";
import { useAnalytics } from "@/lib/queries";

const txConfig = {
  count: { label: "Transactions", color: "var(--chart-1)" },
  succeeded: { label: "Succeeded", color: "var(--chart-2)" },
} satisfies ChartConfig;

const volConfig = {
  volume: { label: "Volume", color: "var(--chart-1)" },
} satisfies ChartConfig;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading analytics…</p>;
  }

  const { summary, statusBreakdown, primaryCurrency, timeSeries } = data;
  const volumeLabel =
    summary.volume
      .map((v) => formatMoney(v.amount, v.currency))
      .join(" · ") || "—";

  const stats = [
    { label: "Total payments", value: summary.totalPayments },
    { label: "Succeeded", value: summary.succeeded },
    { label: "Success rate", value: `${Math.round(summary.successRate * 100)}%` },
    { label: "Captured volume", value: volumeLabel },
  ];

  const statusData = statusBreakdown.map((s) => ({
    status: STATUS_LABEL[s.status],
    count: s.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Payment activity over the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions over time</CardTitle>
          <CardDescription>Total vs. succeeded payments per day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={txConfig} className="h-[260px] w-full">
            <AreaChart data={timeSeries} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={shortDate}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => shortDate(String(label))}
                  />
                }
              />
              <Area
                dataKey="count"
                type="natural"
                fill="var(--color-count)"
                fillOpacity={0.15}
                stroke="var(--color-count)"
                strokeWidth={2}
              />
              <Area
                dataKey="succeeded"
                type="natural"
                fill="var(--color-succeeded)"
                fillOpacity={0.15}
                stroke="var(--color-succeeded)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Captured volume ({primaryCurrency})
            </CardTitle>
            <CardDescription>Succeeded volume per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={volConfig} className="h-[240px] w-full">
              <BarChart data={timeSeries} margin={{ left: -8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={shortDate}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => shortDate(String(label))}
                      formatter={(value) => formatMoney(Number(value), primaryCurrency)}
                    />
                  }
                />
                <Bar dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status breakdown</CardTitle>
            <CardDescription>All payments by status.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={volConfig} className="h-[240px] w-full">
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ left: 20, right: 8 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-volume)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
