"use client"

import { useEffect, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Users, Package, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAdminAuth } from "@/components/admin-auth-provider"
import { ADMIN_HOME } from "@/lib/admin-routes"
import { cn } from "@/lib/utils"
import {
  MONTH_RANGE_OPTIONS,
  type MonthRange,
} from "@/components/admin-pagination"
import {
  formatPrice,
  formatTrend,
  getDashboardStats,
  type DashboardStats,
} from "@/lib/supabase/admin-dashboard"

const STATUS_STYLES: Record<string, string> = {
  fulfilled: "bg-green-50 text-green-700 border-green-200",
  processing: "bg-lavender text-gold border-gold/30",
  shipped: "bg-lavender text-lavender-foreground border-lavender",
  pending: "bg-gray-50 text-gray-500 border-gray-200",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-destructive/10 text-destructive border-destructive/20",
}

function StatCard({
  label, value, subvalue, icon: Icon, trend, trendUp, trendSuffix = "vs prior period",
}: {
  label: string
  value: string
  subvalue: string
  icon: React.ElementType
  trend: string
  trendUp: boolean
  trendSuffix?: string
}) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-light uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-serif text-3xl font-medium">{value}</p>
          <p className="mt-1 text-xs font-light text-muted-foreground">{subvalue}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {trendUp ? (
          <TrendingUp className="size-3.5 text-green-600" />
        ) : (
          <TrendingDown className="size-3.5 text-destructive" />
        )}
        <span className={cn("text-[11px] font-medium", trendUp ? "text-green-600" : "text-destructive")}>
          {trend}
        </span>
        <span className="text-[11px] font-light text-muted-foreground">{trendSuffix}</span>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-background px-4 py-3 shadow-md text-xs">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-light text-muted-foreground">
          <span className="font-medium text-foreground">{entry.name}:</span>{" "}
          {typeof entry.value === "number" && entry.name.toLowerCase().includes("revenue")
            ? formatPrice(entry.value)
            : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  // Server-side the dashboard layout already sends sub admins to Products; this covers local
  // mock mode, where the role only exists in the browser session.
  const { session } = useAdminAuth()
  const router = useRouter()
  useEffect(() => {
    if (session?.role === "sub_admin") router.replace(ADMIN_HOME.sub_admin)
  }, [session?.role, router])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<MonthRange>(1)

  useEffect(() => {
    setLoading(true)
    getDashboardStats(months).then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [months])

  const revenueTrend = formatTrend(stats?.revenue30d ?? 0, stats?.revenuePrev30d ?? 0)
  const aovTrend = formatTrend(stats?.avgOrderValue ?? 0, stats?.aovPrev ?? 0)
  const year = new Date().getFullYear()
  const rangeShort = `${months} mo`
  const customersSub = months === 1 ? "new this month" : `new in last ${months} months`

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-medium sm:text-2xl">Dashboard</h1>
          <p className="mt-0.5 max-w-xl text-xs font-light text-muted-foreground">
            Live commerce metrics from Supabase. Traffic uses Vercel Analytics in production.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {MONTH_RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMonths(opt.value)}
                className={cn(
                  "border px-3 py-1.5 text-[11px] font-light uppercase tracking-[0.12em] transition-all",
                  months === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {stats && stats.pendingOrders > 0 && (
            <Link
              href="/admin/orders"
              className="inline-flex w-full items-center justify-center border border-gold/40 bg-lavender px-4 py-2.5 text-xs font-medium text-gold hover:bg-secondary transition-colors sm:w-auto"
            >
              {stats.pendingOrders} pending order{stats.pendingOrders !== 1 ? "s" : ""}
            </Link>
          )}
        </div>
      </div>

      <div className="admin-page-body space-y-8">
        {loading || !stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={`Revenue (${rangeShort})`}
                value={formatPrice(stats.revenue30d)}
                subvalue={`${stats.paidOrders30d} paid order${stats.paidOrders30d !== 1 ? "s" : ""}`}
                icon={DollarSign}
                trend={revenueTrend.label}
                trendUp={revenueTrend.up}
                trendSuffix="vs prior period"
              />
              <StatCard
                label="Customers"
                value={stats.customerCount.toLocaleString()}
                subvalue={`${stats.customersThisMonth} ${customersSub}`}
                icon={Users}
                trend={`${stats.customersThisMonth >= 0 ? "+" : ""}${stats.customersThisMonth}`}
                trendUp
                trendSuffix="vs prior period"
              />
              <StatCard
                label="Products Listed"
                value={String(stats.productCount)}
                subvalue={`${stats.inStockCount} in stock`}
                icon={Package}
                trend={`${stats.pendingOrders} pending orders`}
                trendUp={stats.pendingOrders === 0}
                trendSuffix="in range"
              />
              <StatCard
                label="Avg. Order Value"
                value={formatPrice(stats.avgOrderValue)}
                subvalue={`Paid orders · last ${months} mo`}
                icon={ShoppingBag}
                trend={aovTrend.label}
                trendUp={aovTrend.up}
                trendSuffix="vs prior period"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 border border-border bg-card p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-sm font-medium">Revenue Overview</h2>
                    <p className="text-xs font-light text-muted-foreground mt-0.5">
                      Monthly paid revenue & orders — {year}
                    </p>
                  </div>
                  <span className={cn(
                    "flex items-center gap-1 text-[11px] font-medium",
                    revenueTrend.up ? "text-green-600" : "text-destructive",
                  )}>
                    {revenueTrend.up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {revenueTrend.label} ({rangeShort})
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={stats.monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-gold)" strokeWidth={2} fill="url(#revenueGrad)" />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke="var(--color-foreground)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-border bg-card p-6">
                <h2 className="mb-1 text-sm font-medium">Sales by Category</h2>
                <p className="mb-4 text-xs font-light text-muted-foreground">% of paid order value ({year})</p>
                {stats.categoryShare.length === 0 ? (
                  <p className="text-sm font-light text-muted-foreground py-16 text-center">No paid sales yet</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={stats.categoryShare}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {stats.categoryShare.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, "Share"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1.5">
                      {stats.categoryShare.slice(0, 4).map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="font-light text-muted-foreground">{item.name}</span>
                          </div>
                          <span className="font-medium">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3 border border-border bg-card p-6">
                <div className="mb-5">
                  <h2 className="text-sm font-medium">Orders this week</h2>
                  <p className="text-xs font-light text-muted-foreground mt-0.5">
                    Commerce activity (paid orders) — not website traffic. Storefront visits are tracked with Vercel Analytics in production.
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.ordersByWeekday} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
                    <Bar dataKey="orders" name="Orders" fill="var(--color-muted)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--color-gold)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-2 border border-border bg-card p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Top Products</h2>
                  <Link href="/admin/products" className="flex items-center gap-1 text-[11px] font-light text-gold hover:underline underline-offset-2">
                    View all <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                {stats.topProducts.length === 0 ? (
                  <p className="text-sm font-light text-muted-foreground py-8 text-center">No sales data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {stats.topProducts.map((product, i) => (
                      <li key={product.name} className="flex items-center gap-3">
                        <span className="w-4 text-[11px] font-light text-muted-foreground shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{product.name}</p>
                          <p className="text-[10px] font-light text-muted-foreground">{product.sales} sold</p>
                        </div>
                        <p className="text-xs font-medium shrink-0">{formatPrice(product.revenue)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="admin-table-panel border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h2 className="text-sm font-medium">Recent Orders</h2>
                  <p className="text-xs font-light text-muted-foreground mt-0.5">Latest transactions across the store</p>
                </div>
                <Link href="/admin/orders" className="flex items-center gap-1 text-[11px] font-light text-gold hover:underline underline-offset-2">
                  View all <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <div className="admin-table-scroll hidden lg:block">
                <table className="admin-data-table w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-6 py-3 text-left font-medium uppercase tracking-[0.15em] text-muted-foreground">Order</th>
                      <th className="px-6 py-3 text-left font-medium uppercase tracking-[0.15em] text-muted-foreground">Customer</th>
                      <th className="px-6 py-3 text-left font-medium uppercase tracking-[0.15em] text-muted-foreground hidden sm:table-cell">Product</th>
                      <th className="px-6 py-3 text-left font-medium uppercase tracking-[0.15em] text-muted-foreground">Amount</th>
                      <th className="px-6 py-3 text-left font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-light">
                          No orders yet
                        </td>
                      </tr>
                    ) : (
                      stats.recentOrders.map((order) => (
                        <tr key={order.reference} className="hover:bg-secondary transition-colors">
                          <td className="px-6 py-4 font-mono text-muted-foreground">
                            <Link href={`/admin/orders/${order.reference}`} className="hover:text-foreground">
                              {order.reference}
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-medium">{order.customer.name}</td>
                          <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell truncate max-w-[180px]">
                            {order.items[0]?.name ?? "—"}
                            {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                          </td>
                          <td className="px-6 py-4 font-medium">{formatPrice(order.total)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]",
                              STATUS_STYLES[order.status] ?? STATUS_STYLES.pending,
                            )}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="admin-table-fill" aria-hidden="true">
                      <td colSpan={5} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {stats.recentOrders.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm font-light text-muted-foreground">No orders yet</p>
                ) : (
                  stats.recentOrders.map((order) => (
                    <Link
                      key={order.reference}
                      href={`/admin/orders/${order.reference}`}
                      className="flex flex-col gap-2 px-4 py-4 transition-colors hover:bg-secondary sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{order.reference}</p>
                        <p className="text-sm font-medium">{order.customer.name}</p>
                        <p className="truncate text-xs font-light text-muted-foreground">
                          {order.items[0]?.name ?? "—"}
                          {order.items.length > 1 ? ` +${order.items.length - 1}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <p className="text-sm font-medium">{formatPrice(order.total)}</p>
                        <span className={cn(
                          "border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]",
                          STATUS_STYLES[order.status] ?? STATUS_STYLES.pending,
                        )}>
                          {order.status}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
