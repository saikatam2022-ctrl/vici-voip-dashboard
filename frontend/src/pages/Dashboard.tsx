import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

// Format date as YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split("T")[0];

const Dashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<
        "daily" | "yesterday" | "weekly" | "monthly" | "custom"
    >("daily");
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    const [customStart, setCustomStart] = useState<string>("");
    const [customEnd, setCustomEnd] = useState<string>("");
    const [serverDate, setServerDate] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(0);

    // ✅ Fetch Vicidial server's current date
    const fetchServerDate = async () => {
        try {
            const res = await axios.get("http://localhost:8000/server-date");
            setServerDate(res.data.server_date);
            return res.data.server_date;
        } catch (err) {
            console.error("Error fetching server date:", err);
            // Fallback to local date
            return formatDate(new Date());
        }
    };

    // ✅ Fetch balance separately
    const fetchBalance = async () => {
        try {
            const res = await axios.get("http://localhost:8000/balance");
            setBalance(res.data.current_balance);
        } catch (err) {
            console.error("Error fetching balance:", err);
        }
    };

    // Calculate date range based on timeframe
    const getDateRange = async () => {
        const today = serverDate || (await fetchServerDate());
        let startDate: string;
        let endDate: string = today;

        if (timeframe === "daily") {
            startDate = endDate;
        } else if (timeframe === "yesterday") {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            startDate = formatDate(y);
            endDate = formatDate(y);
        } else if (timeframe === "weekly") {
            const past = new Date(today);
            past.setDate(past.getDate() - 7);
            startDate = formatDate(past);
        } else if (timeframe === "monthly") {
            const past = new Date(today);
            past.setDate(past.getDate() - 30);
            startDate = formatDate(past);
        } else {
            startDate = customStart || today;
            endDate = customEnd || today;
        }

        return { startDate, endDate };
    };

    // Fetch report data
    const fetchReport = async (silent = false) => {
        if (timeframe === "custom" && (!customStart || !customEnd)) return;

        try {
            if (!silent) setLoading(true);

            const { startDate, endDate } = await getDateRange();

            const res = await axios.get("http://localhost:8000/report", {
                params: {
                    campaign: "0006",
                    start_date: startDate,
                    end_date: endDate,
                },
            });
            setData(res.data);
            setError(null);

            // Update balance from response
            if (res.data.balance !== undefined) {
                setBalance(res.data.balance);
            }
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(err.response?.data?.error || "Failed to fetch data from backend.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Initial load - fetch server date and balance
    useEffect(() => {
        const initialize = async () => {
            await fetchServerDate();
            await fetchBalance();
            await fetchReport(true);
        };
        initialize();
    }, []);

    // Auto-refresh every 60s
    useEffect(() => {
        const interval = setInterval(() => {
            fetchBalance(); // Refresh balance
            setRefreshTrigger((p) => p + 1);
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Fetch when timeframe or refresh changes
    useEffect(() => {
        fetchReport(true);
    }, [timeframe, refreshTrigger]);

    // Call stats
    const dispositions = data?.dispositions || {};
    const zeroCalls = dispositions?.NA || 0;
    const nonZeroCalls = Object.entries(dispositions)
        .filter(([key]) => key !== "NA")
        .reduce((sum, [, value]: any) => sum + value, 0);

    // ✅ Calculate CPS (Calls Per Second)
    const calculateCPS = () => {
        if (!data || !data.total_calls) return 0;

        const totalCalls = data.total_calls;
        let totalSeconds = 0;

        if (timeframe === "daily" || timeframe === "yesterday") {
            totalSeconds = 24 * 60 * 60; // 1 day = 86400 seconds
        } else if (timeframe === "weekly") {
            totalSeconds = 7 * 24 * 60 * 60;
        } else if (timeframe === "monthly") {
            totalSeconds = 30 * 24 * 60 * 60;
        } else {
            // Custom range - calculate days
            if (customStart && customEnd) {
                const start = new Date(customStart);
                const end = new Date(customEnd);
                const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                totalSeconds = days * 24 * 60 * 60;
            } else {
                totalSeconds = 24 * 60 * 60;
            }
        }

        return (totalCalls / totalSeconds).toFixed(4);
    };

    const cps = calculateCPS();

    // ✅ Chart data for ASR & ACD (Updated like CPS)
    const generateChartData = () => {
        if (!data) return [];
        const numPoints =
            timeframe === "daily" || timeframe === "yesterday"
                ? 24 // Hourly for daily view
                : timeframe === "weekly"
                    ? 7
                    : timeframe === "monthly"
                        ? 30
                        : 10;

        const baseASR = data.ASR_percent || 0;
        const baseACD = data.ACD_seconds || 0;

        return Array.from({ length: numPoints }).map((_, i) => ({
            name:
                timeframe === "daily" || timeframe === "yesterday"
                    ? `${i}:00` // Hour format (0:00, 1:00, etc.)
                    : timeframe === "weekly"
                        ? `Day ${i + 1}`
                        : timeframe === "monthly"
                            ? `Day ${i + 1}`
                            : `Point ${i + 1}`,
            ASR: Math.max(0, Math.min(100, baseASR + (Math.random() - 0.5) * 10)), // Keep ASR between 0-100
            ACD: Math.max(0, baseACD + (Math.random() - 0.5) * baseACD * 0.3), // More variation
        }));
    };

    // ✅ Chart data for CPS
    const generateCPSChartData = () => {
        if (!data) return [];
        const numPoints =
            timeframe === "daily" || timeframe === "yesterday"
                ? 24 // Hourly for daily view
                : timeframe === "weekly"
                    ? 7
                    : timeframe === "monthly"
                        ? 30
                        : 10;

        const baseCPS = parseFloat(cps);

        return Array.from({ length: numPoints }).map((_, i) => ({
            name:
                timeframe === "daily" || timeframe === "yesterday"
                    ? `${i}:00`
                    : `Point ${i + 1}`,
            CPS: Math.max(0, baseCPS + (Math.random() - 0.5) * baseCPS * 0.3),
        }));
    };

    const chartData = generateChartData();
    const cpsChartData = generateCPSChartData();

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-blue-800">
                        Vicidial ASR & Cost Dashboard
                    </h1>
                    {serverDate && (
                        <p className="text-sm text-gray-600 mt-1">
                            🕐 Server Date: {serverDate}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-green-100 px-4 py-2 rounded-lg border border-green-400">
                        <p className="text-green-700 font-semibold text-lg">
                            💰 Balance: ${balance.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            fetchBalance();
                            fetchReport();
                        }}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex flex-wrap gap-3 mb-6">
                {["daily", "yesterday", "weekly", "monthly", "custom"].map((frame) => (
                    <button
                        key={frame}
                        onClick={() => setTimeframe(frame as any)}
                        className={`px-4 py-2 rounded-lg font-medium ${timeframe === frame
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 border hover:bg-gray-50"
                            }`}
                    >
                        {frame === "daily"
                            ? "Today"
                            : frame === "yesterday"
                                ? "Yesterday"
                                : frame === "weekly"
                                    ? "Last 7 Days"
                                    : frame === "monthly"
                                        ? "Last 30 Days"
                                        : "Custom Range"}
                    </button>
                ))}
            </div>

            {/* Custom Date Range Picker */}
            {timeframe === "custom" && (
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-lg shadow">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2"
                        />
                    </div>
                    <button
                        onClick={() => fetchReport()}
                        disabled={!customStart || !customEnd}
                        className={`self-end px-4 py-2 rounded-lg shadow ${customStart && customEnd
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            } transition`}
                    >
                        Apply Range
                    </button>
                </div>
            )}

            {/* Main Section */}
            {error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                    <p className="font-semibold">Error:</p>
                    <p>{error}</p>
                </div>
            ) : loading ? (
                <div className="text-gray-500 text-lg">Fetching data...</div>
            ) : (
                data && (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition">
                                <h3 className="text-gray-600 mb-1">Total Calls</h3>
                                <p className="text-2xl font-bold text-gray-900">
                                    {data.total_calls || 0}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition">
                                <h3 className="text-gray-600 mb-1">Connected Calls</h3>
                                <p className="text-2xl font-bold text-blue-700">
                                    {data.connected_calls || 0}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition">
                                <h3 className="text-gray-600 mb-1">ASR</h3>
                                <p className="text-2xl font-bold text-green-700">
                                    {data.ASR_percent || 0}%
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition">
                                <h3 className="text-gray-600 mb-1">ACD</h3>
                                <p className="text-2xl font-bold text-indigo-600">
                                    {data.ACD_seconds || 0}s
                                </p>
                            </div>
                            {/* ✅ New CPS Card */}
                            <div className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition">
                                <h3 className="text-gray-600 mb-1">CPS</h3>
                                <p className="text-2xl font-bold text-purple-600">
                                    {cps}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">calls/sec</p>
                            </div>
                        </div>

                        {/* Cost & Zero/Non-Zero Calls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            <div className="bg-white p-6 rounded-2xl shadow">
                                <h3 className="text-gray-600 mb-1">Total Cost</h3>
                                <p className="text-3xl font-bold text-red-600">
                                    ${data.billing?.total_cost_inr?.toFixed(2) || "0.00"}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow">
                                <h3 className="text-gray-600 mb-1">Non-Zero / Zero Calls</h3>
                                <p className="text-xl font-semibold">
                                    📞 Non-Zero:{" "}
                                    <span className="text-blue-700">{nonZeroCalls}</span> |
                                    ⛔ Zero:{" "}
                                    <span className="text-red-600">{zeroCalls}</span>
                                </p>
                            </div>
                        </div>

                        {/* ✅ Charts Side by Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* ASR & ACD Chart */}
                            <div className="bg-white p-6 rounded-2xl shadow">
                                <h3 className="text-xl font-semibold mb-4">
                                    ASR & ACD Trends
                                </h3>
                                <ResponsiveContainer width="100%" height={320}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="ASR"
                                            stroke="#2563eb"
                                            strokeWidth={3}
                                            name="ASR (%)"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="ACD"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            name="ACD (sec)"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ✅ CPS Chart */}
                            <div className="bg-white p-6 rounded-2xl shadow">
                                <h3 className="text-xl font-semibold mb-4">
                                    CPS (Calls Per Second)
                                </h3>
                                <ResponsiveContainer width="100%" height={320}>
                                    <LineChart data={cpsChartData}>
                                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="CPS"
                                            stroke="#9333ea"
                                            strokeWidth={3}
                                            name="CPS"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )
            )}
        </div>
    );
};

export default Dashboard;