import React, { useEffect, useState, useCallback, useMemo } from "react";
import apiClient from "../api/axiosConfig";
import { Link } from "react-router-dom";

// -----------------------------
// Types
// -----------------------------
interface Payment {
    id: number;
    amount: number;
    payment_type: string;
    description: string;
    previous_balance: number;
    new_balance: number;
    timestamp: string;
    date: string;
    time: string;
}

interface PaymentStats {
    total_transactions: number;
    total_recharges: number;
    total_recharged_amount: number;
    total_deductions: number;
    total_deducted_amount: number;
}

const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        Number(n || 0)
    );

const neonGlow = "shadow-[0_10px_30px_rgba(99,102,241,0.12)]";

// -----------------------------
// 7-DAY chart helpers
// -----------------------------
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

const PaymentHistory: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [stats, setStats] = useState<PaymentStats | null>(null);
    const [balance, setBalance] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // filters
    const [type, setType] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // pagination
    const [page, setPage] = useState(1);
    const limit = 20;

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);

            const params: any = { limit, offset: (page - 1) * limit };
            if (type !== "all") params.payment_type = type;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const res = await apiClient.get("/payment-history", { params });
            setPayments(res.data.payments || []);
            setError(null);
        } catch {
            setError("Failed to fetch payments.");
        } finally {
            setLoading(false);
        }
    }, [page, type, startDate, endDate]);

    const fetchStats = useCallback(async () => {
        try {
            const params: any = {};
            if (type !== "all") params.payment_type = type;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            const res = await apiClient.get("/payment-history/stats", { params });
            setStats(res.data);
        } catch (err) {
            console.error("Stats error", err);
        }
    }, [type, startDate, endDate]);

    const fetchBalance = async () => {
        try {
            const res = await apiClient.get("/balance");
            setBalance(res.data.current_balance || 0);
        } catch { }
    };

    useEffect(() => {
        fetchBalance();
        fetchStats();
        fetchPayments();
    }, [fetchPayments, fetchStats]);

    // -----------------------------
    // DAILY EOD DEDUCTION
    // -----------------------------
    const getDailyDeduction = () =>
        payments
            .filter((p) => p.payment_type === "deduction")
            .reduce((sum, p) => sum + p.amount, 0);

    // -----------------------------
    // 7-DAY DEDUCTION TREND
    // -----------------------------
    const sevenDayData = useMemo(() => {
        const today = new Date();
        const map: { [date: string]: number } = {};

        payments
            .filter((p) => p.payment_type === "deduction")
            .forEach((p) => {
                map[p.date] = (map[p.date] || 0) + p.amount;
            });

        const arr = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split("T")[0];
            arr.push({
                date: key,
                amount: map[key] || 0,
            });
        }
        return arr;
    }, [payments]);

    const chartData = {
        labels: sevenDayData.map((d) => d.date),
        datasets: [
            {
                label: "Daily Deduction",
                data: sevenDayData.map((d) => d.amount),
                borderColor: "rgba(99,102,241,0.9)",
                backgroundColor: "rgba(99,102,241,0.15)",
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: "rgba(99,102,241,1)",
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { ticks: { color: "#CBD5E1" }, beginAtZero: true },
            x: { ticks: { color: "#CBD5E1" } },
        },
    };

    // -----------------------------
    // UI
    // -----------------------------
    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#0f172a,_#0b1221)] text-gray-100 p-6">
            <div className="max-w-[1400px] mx-auto space-y-8">

                {/* HEADER (unchanged) */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className={`p-3 rounded-3xl bg-white/6 backdrop-blur-sm border border-white/6 ${neonGlow}`}
                        >
                            <svg className="w-8 h-8 text-white/90" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                                <circle cx="12" cy="12" r="9" strokeWidth="1.2" />
                                <path d="M12 8c-1.8 0-3 .9-3 2s1.2 2 3 2 3 .9 3 2-1.2 2-3 2" strokeWidth="1.6" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold bg-gradient-to-r from-indigo-300 to-cyan-200 bg-clip-text text-transparent">
                                Payment History
                            </h1>
                            <p className="text-sm text-white/60 mt-1">Ultra-modern VisionOS-style transaction analytics</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="rounded-xl px-4 py-2 bg-white/6 backdrop-blur-sm border border-white/6 flex items-center gap-3">
                            <span className="text-sm text-white/80">Balance</span>
                            <span className="text-lg font-semibold text-white">{money(balance)}</span>
                        </div>
                        <Link to="/" className="px-4 py-2 rounded-xl bg-white/6 border border-white/8 text-white/80 hover:bg-white/10">
                            Dashboard
                        </Link>
                    </div>
                </header>

                {/* FILTERS (unchanged) */}
                <section className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="text-sm text-white/70">Transaction Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full mt-2 px-3 py-2 rounded-lg bg-white/6 text-white border border-white/10"
                            >
                                <option value="all">All</option>
                                <option value="recharge">Recharge</option>
                                <option value="deduction">Deduction</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-white/70">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full mt-2 px-3 py-2 rounded-lg bg-white/6 text-white border border-white/10"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-white/70">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full mt-2 px-3 py-2 rounded-lg bg-white/6 text-white border border-white/10"
                            />
                        </div>

                        <button
                            onClick={() => {
                                setPage(1);
                                fetchPayments();
                                fetchStats();
                            }}
                            className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-black font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                        >
                            Apply Filters
                        </button>
                    </div>
                </section>

                {/* STATS (unchanged) */}
                {stats && (
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        {[
                            { label: "Total Transactions", value: stats.total_transactions },
                            { label: "Total Recharges", value: money(stats.total_recharged_amount) },
                            { label: "Total Deductions", value: money(stats.total_deducted_amount) },
                            {
                                label: "Net Flow",
                                value: money(stats.total_recharged_amount - stats.total_deducted_amount),
                            },
                            { label: "Today's Deduction", value: money(getDailyDeduction()) },
                        ].map((card, i) => (
                            <div key={i} className="rounded-2xl bg-white/4 backdrop-blur-md border border-white/10 p-6 shadow-xl">
                                <p className="text-sm text-white/70">{card.label}</p>
                                <h3 className="text-2xl font-semibold text-white mt-1">{card.value}</h3>
                            </div>
                        ))}
                    </section>
                )}

                {/* NEW ⭐ 7-DAY TREND CHART */}
                <section className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 p-6 shadow-xl">
                    <h2 className="text-xl font-semibold text-white mb-4">7-Day Deduction Trend</h2>
                    <Line data={chartData} options={chartOptions} height={120} />
                </section>

                {/* TABLE (unchanged) */}
                <section className="rounded-2xl bg-white/4 backdrop-blur-sm border border-white/6 overflow-hidden">
                    {error ? (
                        <div className="p-6 text-red-400">{error}</div>
                    ) : loading ? (
                        <div className="p-8 text-center text-white/60">Loading...</div>
                    ) : payments.length === 0 ? (
                        <div className="p-8 text-center text-white/60">No transactions found</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-white/70">Date & Time</th>
                                        <th className="px-6 py-3 text-left text-white/70">Type</th>
                                        <th className="px-6 py-3 text-left text-white/70">Description</th>
                                        <th className="px-6 py-3 text-right text-white/70">Amount</th>
                                        <th className="px-6 py-3 text-right text-white/70">Prev Balance</th>
                                        <th className="px-6 py-3 text-right text-white/70">New Balance</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-white/10">
                                    {payments.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/5 transition">
                                            <td className="px-6 py-3">
                                                {p.date}
                                                <div className="text-xs text-white/50">{p.time}</div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${p.payment_type === "recharge"
                                                            ? "bg-green-400/20 text-green-300"
                                                            : "bg-red-400/20 text-red-300"
                                                        }`}
                                                >
                                                    {p.payment_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-white/80">{p.description}</td>
                                            <td
                                                className={`px-6 py-3 text-right font-semibold ${p.payment_type === "recharge"
                                                        ? "text-green-300"
                                                        : "text-red-300"
                                                    }`}
                                            >
                                                {p.payment_type === "recharge" ? "+" : "-"}
                                                {money(p.amount)}
                                            </td>
                                            <td className="px-6 py-3 text-right text-white/60">
                                                {money(p.previous_balance)}
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-white">
                                                {money(p.new_balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* ⭐ PAGINATION UI */}
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-4 py-2 bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl text-white/80 disabled:opacity-30 hover:bg-white/10"
                    >
                        Prev
                    </button>

                    <span className="text-white/70">
                        Page <span className="text-white">{page}</span>
                    </span>

                    <button
                        disabled={payments.length < limit}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-4 py-2 bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl text-white/80 disabled:opacity-30 hover:bg-white/10"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistory;
