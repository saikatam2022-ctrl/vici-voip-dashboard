import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import apiClient from "../api/axiosConfig";

// -----------------------------
// Types & Helpers
// -----------------------------
type ASRTimeframe = "hour" | "day" | "week" | "month";
type ConnectedCallsTimeframe = "15min" | "30min" | "1hour";
type MainTimeframe = "live" | "yesterday" | "weekly" | "monthly" | "custom";

interface ChartDataPoint {
    time: string;
    connected_calls: number;
}

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const money = (n: number | undefined | null) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        Number(n || 0)
    );

const neonGlow = "shadow-[0_10px_30px_rgba(99,102,241,0.12)]";

// -----------------------------
// Component
// -----------------------------
const Dashboard: React.FC = () => {
    // data + status
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [serverDate, setServerDate] = useState<string>("");
    const [balance, setBalance] = useState<number>(0);

    // timeframe controls
    const [timeframe, setTimeframe] = useState<MainTimeframe>("live");
    const [customStart, setCustomStart] = useState<string>("");
    const [customEnd, setCustomEnd] = useState<string>("");

    // refresh / charts
    const [refreshKey, setRefreshKey] = useState<number>(0);
    const [asrTimeframe, setAsrTimeframe] = useState<ASRTimeframe>("day");
    const [connectedCallsTimeframe, setConnectedCallsTimeframe] =
        useState<ConnectedCallsTimeframe>("30min");

    // chart data
    const [asrChartData, setAsrChartData] = useState<ChartDataPoint[]>([]);
    const [connectedCallsData, setConnectedCallsData] = useState<ChartDataPoint[]>(
        []
    );
    const [chartLoading, setChartLoading] = useState<boolean>(false);

    // -----------------------------
    // API Calls
    // -----------------------------
    const fetchServerDate = async (): Promise<string> => {
        try {
            const res = await apiClient.get("/server-date");
            const sd = res.data.server_date;
            setServerDate(sd);
            return sd;
        } catch (e) {
            console.error("fetchServerDate:", e);
            const fallback = formatDate(new Date());
            setServerDate(fallback);
            return fallback;
        }
    };

    const fetchBalance = async () => {
        try {
            const res = await apiClient.get("/balance");
            setBalance(Number(res.data.current_balance || 0));
        } catch (e) {
            console.error("fetchBalance:", e);
        }
    };

    const fetchASRChart = async () => {
        try {
            setChartLoading(true);
            const res = await apiClient.get("/chart/asr", {
                params: { timeframe: asrTimeframe, campaign: "0006" },
            });
            if (res.data && res.data.success) {
                setAsrChartData(res.data.data || []);
            }
        } catch (e) {
            console.error("fetchASRChart:", e);
        } finally {
            setChartLoading(false);
        }
    };

    const fetchConnectedCallsChart = async () => {
        try {
            setChartLoading(true);
            const res = await apiClient.get("/chart/connected-calls-live", {
                params: { timeframe: connectedCallsTimeframe, campaign: "0006" },
            });
            if (res.data && res.data.success) {
                setConnectedCallsData(res.data.data || []);
            }
        } catch (e) {
            console.error("fetchConnectedCallsChart:", e);
        } finally {
            setChartLoading(false);
        }
    };

    const getDateRange = async () => {
        const today = serverDate || (await fetchServerDate());
        let startDate = today;
        let endDate = today;

        if (timeframe === "yesterday") {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            startDate = endDate = formatDate(y);
        } else if (timeframe === "weekly") {
            const w = new Date(today);
            w.setDate(w.getDate() - 7);
            startDate = formatDate(w);
        } else if (timeframe === "monthly") {
            const m = new Date(today);
            m.setDate(m.getDate() - 30);
            startDate = formatDate(m);
        } else if (timeframe === "custom") {
            startDate = customStart || today;
            endDate = customEnd || today;
        }

        return { startDate, endDate };
    };

    const fetchReport = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const { startDate, endDate } = await getDateRange();
            const res = await apiClient.get("/report", {
                params: { campaign: "0006", start_date: startDate, end_date: endDate },
            });

            setData(res.data);
            if (res.data && res.data.balance !== undefined) {
                setBalance(Number(res.data.balance || 0));
            }
            setError(null);
        } catch (e: any) {
            console.error("fetchReport:", e);
            setError(e?.response?.data?.error || "Failed to fetch report");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // -----------------------------
    // Lifecycle
    // -----------------------------
    useEffect(() => {
        const init = async () => {
            await fetchServerDate();
            await fetchBalance();
            await fetchReport(true);
            await fetchASRChart();
            await fetchConnectedCallsChart();
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // live auto-refresh every 60s when in live mode
    useEffect(() => {
        if (timeframe !== "live") return;
        const id = setInterval(() => {
            fetchReport(true);
            fetchBalance();
            fetchConnectedCallsChart();
        }, 60000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe, connectedCallsTimeframe]);

    // refresh when timeframe or refreshKey changes
    useEffect(() => {
        fetchReport(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe, refreshKey]);

    useEffect(() => {
        fetchASRChart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asrTimeframe]);

    useEffect(() => {
        fetchConnectedCallsChart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectedCallsTimeframe]);

    // -----------------------------
    // Derived stats
    // -----------------------------
    const dispositions = data?.dispositions || {};
    const zeroCalls = dispositions.NA || 0;
    const nonZeroCalls = Object.entries(dispositions)
        .filter(([k]) => k !== "NA")
        .reduce((s, [, v]: any) => s + v, 0);
    const total = data?.total_calls || 0;

    // -----------------------------
    // Actions
    // -----------------------------
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
    };

    const manualRefresh = async () => {
        await Promise.all([fetchReport(), fetchASRChart(), fetchConnectedCallsChart(), fetchBalance()]);
        setRefreshKey((k) => k + 1);
    };

    // -----------------------------
    // UI
    // -----------------------------
    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#0f172a,_#0b1221)] text-gray-100 p-6">
            <div className="max-w-[1400px] mx-auto space-y-6">
                {/* Header */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div
                            className={`p-3 rounded-3xl bg-white/6 backdrop-blur-sm border border-white/6 ${neonGlow}`}
                            style={{ boxShadow: "0 8px 40px rgba(99,102,241,0.08)" }}
                        >
                            <svg
                                className="w-8 h-8 text-white/90"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2"
                                    strokeWidth="1.6"
                                />
                                <circle cx="12" cy="12" r="9" strokeWidth="1.2" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
                                Vicidial <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-200">Analytics</span>
                            </h1>
                            <p className="text-sm text-white/60 mt-1">Realtime insights · Frosted interface · Neon accents</p>
                            {serverDate && (
                                <div className="mt-2 text-xs text-white/50 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.3)]"></span>
                                    Server date: {serverDate}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="rounded-xl px-4 py-2 bg-white/6 backdrop-blur-sm border border-white/6 flex items-center gap-3">
                            <div className="text-sm text-white/80">Balance</div>
                            <div className="text-lg font-semibold text-white">{money(balance)}</div>
                        </div>

                        <button
                            onClick={manualRefresh}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 text-white font-medium shadow-lg hover:scale-[1.02] transition-transform"
                        >
                            Refresh
                        </button>

                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-xl bg-white/6 border border-white/8 text-white/80 hover:bg-white/8 transition"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Timeframe + Quick Actions */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-2 rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-4 flex flex-wrap items-center gap-3">
                        {[
                            { key: "live", label: "Today (Live)" },
                            { key: "yesterday", label: "Yesterday" },
                            { key: "weekly", label: "Last 7 Days" },
                            { key: "monthly", label: "Last 30 Days" },
                            { key: "custom", label: "Custom Range" },
                        ].map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTimeframe(t.key as MainTimeframe)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${timeframe === (t.key as MainTimeframe)
                                        ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-black shadow-md"
                                        : "bg-white/5 text-white/80 hover:bg-white/8"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}

                        <Link
                            to="/payment-history"
                            className="ml-auto px-3 py-2 rounded-lg bg-white/6 hover:bg-white/8 text-white/80"
                        >
                            Payment History
                        </Link>
                    </div>

                    <div className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-4 flex flex-col gap-3">
                        {timeframe === "custom" ? (
                            <>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="px-3 py-2 rounded-lg bg-white/3 border border-white/6 text-white/90"
                                    />
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="px-3 py-2 rounded-lg bg-white/3 border border-white/6 text-white/90"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fetchReport()}
                                        disabled={!customStart || !customEnd}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${customStart && customEnd
                                                ? "bg-gradient-to-r from-indigo-500 to-cyan-400 text-black"
                                                : "bg-white/5 text-white/50 cursor-not-allowed"
                                            }`}
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCustomStart("");
                                            setCustomEnd("");
                                        }}
                                        className="px-3 py-2 rounded-lg bg-white/5 text-white/80"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-white/70">Select timeframe to view report</div>
                        )}
                    </div>
                </section>

                {/* Summary Cards */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card builder */}
                    {[
                        {
                            title: "Total Calls",
                            value: data?.total_calls?.toLocaleString() || "0",
                            accent: "from-indigo-400 to-cyan-300",
                        },
                        {
                            title: "Connected Calls",
                            value: data?.connected_calls?.toLocaleString() || "0",
                            accent: "from-blue-400 to-sky-300",
                        },
                        {
                            title: "ASR",
                            value: `${Number(data?.ASR_percent || 0).toFixed(2)}%`,
                            accent: "from-emerald-300 to-green-400",
                        },
                        {
                            title: "ACD",
                            value: `${Number(data?.ACD_seconds || 0).toFixed(2)}s`,
                            accent: "from-purple-300 to-violet-400",
                        },
                    ].map((c, i) => (
                        <div
                            key={i}
                            className="rounded-2xl p-4 bg-white/3 backdrop-blur-sm border border-white/6"
                            style={{
                                boxShadow: "0 8px 30px rgba(2,6,23,0.45)",
                                overflow: "hidden",
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-white/70">{c.title}</p>
                                    <h3 className="text-2xl font-semibold mt-1 text-white">{c.value}</h3>
                                </div>
                                <div
                                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center text-black font-bold`}
                                    style={{
                                        transform: "translateZ(0)",
                                        boxShadow: "0 8px 24px rgba(99,102,241,0.12)",
                                    }}
                                >
                                    {/* small neon icon */}
                                    <svg className="w-6 h-6 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M3 12h18" strokeWidth="1.4"></path>
                                        <path d="M12 3v18" strokeWidth="1.4"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                {/* Cost & Distribution */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6">
                        <h4 className="text-sm text-white/70">Total Cost</h4>
                        <div className="flex items-center gap-4 mt-4">
                            <div className="text-3xl font-bold text-white">{money(data?.billing?.total_cost_inr)}</div>
                            <div className="text-sm text-white/60">Billed for selected date range</div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6">
                        <h4 className="text-sm text-white/70">Call Distribution</h4>
                        <div className="mt-4 space-y-4">
                            <div>
                                <div className="flex justify-between text-xs text-white/80">
                                    <span>Non-Zero Calls</span>
                                    <span className="font-medium">{nonZeroCalls.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/6 rounded-full h-2 mt-2 overflow-hidden">
                                    <div
                                        className="h-2 rounded-full"
                                        style={{
                                            width: `${((nonZeroCalls / Math.max(total, 1)) * 100).toFixed(1)}%`,
                                            background: "linear-gradient(90deg,#06b6d4,#7c3aed)",
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-white/80">
                                    <span>Zero Calls</span>
                                    <span className="font-medium">{zeroCalls.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/6 rounded-full h-2 mt-2 overflow-hidden">
                                    <div
                                        className="h-2 rounded-full"
                                        style={{
                                            width: `${((zeroCalls / Math.max(total, 1)) * 100).toFixed(1)}%`,
                                            background: "linear-gradient(90deg,#94a3b8,#475569)",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Charts */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ASR Chart */}
                    <div className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="text-lg font-semibold text-white">ASR Trend (%)</h5>
                            <select
                                value={asrTimeframe}
                                onChange={(e) => setAsrTimeframe(e.target.value as ASRTimeframe)}
                                className="px-3 py-2 rounded-lg bg-white/6 text-white"
                            >
                                <option value="hour">Last Hour</option>
                                <option value="day">Last 24 Hours</option>
                                <option value="week">Last Week</option>
                                <option value="month">Last Month</option>
                            </select>
                        </div>

                        <div style={{ height: 320 }}>
                            {chartLoading ? (
                                <div className="h-full flex items-center justify-center text-white/60">Loading chart...</div>
                            ) : asrChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={asrChartData.map((item) => ({
                                            time: item.time,
                                            asr: Number(((item.connected_calls / (item.connected_calls + 600)) * 100).toFixed(2)),
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#0b1221" />
                                        <XAxis dataKey="time" tick={{ fill: "#cbd5e1" }} />
                                        <YAxis domain={[0, 100]} tick={{ fill: "#cbd5e1" }} />
                                        <Tooltip formatter={(v: any) => `${v}%`} />
                                        <Line
                                            type="monotone"
                                            dataKey="asr"
                                            stroke="url(#asrGradient)"
                                            strokeWidth={3}
                                            dot={false}
                                            isAnimationActive={true}
                                        />
                                        <defs>
                                            <linearGradient id="asrGradient" x1="0" x2="1" y1="0" y2="0">
                                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                                            </linearGradient>
                                        </defs>
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-white/60">
                                    No data — requires historical stats table.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connected Calls Live */}
                    <div className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="text-lg font-semibold text-white">Connected Calls (Live)</h5>
                            <div className="flex gap-2">
                                {(["15min", "30min", "1hour"] as ConnectedCallsTimeframe[]).map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => setConnectedCallsTimeframe(tf)}
                                        className={`px-3 py-1 rounded-lg text-sm transition ${connectedCallsTimeframe === tf ? "bg-gradient-to-r from-cyan-400 to-indigo-400 text-black" : "bg-white/6 text-white/70"
                                            }`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ height: 320 }}>
                            {chartLoading ? (
                                <div className="h-full flex items-center justify-center text-white/60">Loading chart...</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={connectedCallsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#0b1221" />
                                        <XAxis dataKey="time" tick={{ fill: "#cbd5e1" }} />
                                        <YAxis tick={{ fill: "#cbd5e1" }} />
                                        <Tooltip />
                                        <Bar
                                            dataKey="connected_calls"
                                            name="Connected Calls"
                                            radius={[6, 6, 0, 0]}
                                            fill="#60a5fa"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
