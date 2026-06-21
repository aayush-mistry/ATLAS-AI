"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Wallet,
  Download,
  RefreshCw,
  Cpu,
  Hash,
  Clock,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Banknote,
  CalendarDays,
} from "lucide-react";
import {
  DATE_FILTER_OPTIONS,
  DateFilterKey,
  filterByDateRange,
  formatDateRangeLabel,
  getDateRange,
  summarizeTransactions,
  toDateInputValue,
} from "@/lib/analytics";

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "INVENTORY_BUY" | "PAYMENT";
  amount: number;
  txHash: string | null;
  description: string;
  entity: string;
  timestamp: string;
}

// Type metadata
const typeConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode; sign: string; defaultEntity: string; defaultDescription: string }> = {
  DEPOSIT: {
    label: "Revenue / Deposit",
    color: "text-emerald-400",
    bgColor: "bg-emerald-950/30",
    borderColor: "border-emerald-500/20",
    icon: <ArrowDownRight className="w-4 h-4" />,
    sign: "+",
    defaultEntity: "Customer (Lemonade Sale)",
    defaultDescription: "Lemonade sales revenue",
  },
  WITHDRAWAL: {
    label: "Withdrawal",
    color: "text-rose-400",
    bgColor: "bg-rose-950/30",
    borderColor: "border-rose-500/20",
    icon: <ArrowUpRight className="w-4 h-4" />,
    sign: "-",
    defaultEntity: "Owner (Withdrawal)",
    defaultDescription: "Manual treasury withdrawal",
  },
  INVENTORY_BUY: {
    label: "Inventory Purchase",
    color: "text-amber-400",
    bgColor: "bg-amber-950/30",
    borderColor: "border-amber-500/20",
    icon: <ShoppingCart className="w-4 h-4" />,
    sign: "-",
    defaultEntity: "Supplier (Lemonade Ingredients)",
    defaultDescription: "Purchased raw materials / supplies",
  },
  PAYMENT: {
    label: "Worker Payment",
    color: "text-blue-400",
    bgColor: "bg-blue-950/30",
    borderColor: "border-blue-500/20",
    icon: <CreditCard className="w-4 h-4" />,
    sign: "-",
    defaultEntity: "Worker Payment",
    defaultDescription: "Escrow release / payout for completed job",
  },
};

const getCupsSoldText = (tx: Transaction) => {
  if (tx.type !== "DEPOSIT") return null;
  
  if (tx.description) {
    const match = tx.description.match(/Sold\s+(\d+)\s+cup/i);
    if (match && match[1]) {
      return `${match[1]} cup${parseInt(match[1]) > 1 ? "s" : ""}`;
    }
  }
  
  // Fallback estimation based on ₹25 per cup
  const estimated = Math.round(tx.amount / 25);
  if (estimated > 0) {
    return `${estimated} cup${estimated > 1 ? "s" : ""} (est.)`;
  }
  return null;
};

const getRelativeTime = (timestamp: string) => {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
};

const OPENING_BALANCE = 5000; // Seed balance from DB default (BusinessState.walletBalance default)

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("TODAY");
  const [customStart, setCustomStart] = useState(toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [now, setNow] = useState(new Date());

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
        setBalance(data.balance);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // Auto-refresh every 1 second for near real-time updates
    const interval = setInterval(fetchTransactions, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keep the sales simulation running while on this page
  // (mirrors the dashboard's auto-sell so new transactions keep appearing)
  useEffect(() => {
    const salesInterval = setInterval(async () => {
      try {
        await fetch("/api/sales", { method: "POST" });
      } catch (err) {
        // silently ignore – the fetch above is fire-and-forget
      }
    }, 5000); // every 5 seconds, same cadence as dashboard
    return () => clearInterval(salesInterval);
  }, []);

  // Keep CEO auto-tick running while on this page
  useEffect(() => {
    const ceoInterval = setInterval(async () => {
      try {
        await fetch("/api/decision", { method: "POST" });
      } catch (err) {
        // silently ignore
      }
    }, 45000); // every 45 seconds, same cadence as dashboard
    return () => clearInterval(ceoInterval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const analyticsRange = getDateRange(dateFilter, customStart, customEnd, now);
  const dateFilteredTransactions = filterByDateRange(transactions, analyticsRange);
  const rangeLabel = formatDateRangeLabel(analyticsRange);
  const analyticsSummary = summarizeTransactions(dateFilteredTransactions);

  // Filtering
  const filtered = dateFilteredTransactions.filter((tx) => {
    const matchesType = filterType === "ALL" || tx.type === filterType;
    const matchesSearch =
      searchQuery === "" ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.entity && tx.entity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.txHash && tx.txHash.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tx.amount.toString().includes(searchQuery);
    return matchesType && matchesSearch;
  });

  // Summary stats
  const totalDeposits = analyticsSummary.deposits;
  const totalWithdrawals = analyticsSummary.withdrawals;
  const totalInventory = analyticsSummary.inventory;
  const totalPayments = analyticsSummary.payouts;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-200">
        <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-lg font-medium tracking-wide">Loading transaction ledger...</p>
      </div>
    );
  }

  return (
    <div className="spatial-shell spatial-ledger flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Background Accents */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors px-3 py-2 rounded-xl border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10">
                <Banknote className="w-5 h-5 text-zinc-950" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Transaction Ledger
                </h1>
                <p className="text-xs text-zinc-400">
                  Complete blockchain-recorded financial history
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 font-semibold text-sm">
              <Wallet className="w-4 h-4" />
              ₹{balance.toFixed(2)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Credits */}
          <div className="bg-zinc-900/50 border border-emerald-500/15 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Credited</span>
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              +₹{totalDeposits.toFixed(2)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              {dateFilteredTransactions.filter((t) => t.type === "DEPOSIT").length} deposits in range
            </p>
          </div>

          {/* Total Withdrawals */}
          <div className="bg-zinc-900/50 border border-rose-500/15 rounded-2xl p-5 relative overflow-hidden group hover:border-rose-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Total Withdrawn</span>
              <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-400">
              -₹{totalWithdrawals.toFixed(2)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              {dateFilteredTransactions.filter((t) => t.type === "WITHDRAWAL").length} withdrawals in range
            </p>
          </div>

          {/* Inventory Spending */}
          <div className="bg-zinc-900/50 border border-amber-500/15 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Inventory Costs</span>
              <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-400">
              -₹{totalInventory.toFixed(2)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              {dateFilteredTransactions.filter((t) => t.type === "INVENTORY_BUY").length} purchases in range
            </p>
          </div>

          {/* Worker Payments */}
          <div className="bg-zinc-900/50 border border-blue-500/15 rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Worker Payouts</span>
              <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              -₹{totalPayments.toFixed(2)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              {dateFilteredTransactions.filter((t) => t.type === "PAYMENT").length} payments in range
            </p>
          </div>
        </section>

        {/* Date Range Filter */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Transaction Date Range</p>
              <p className="text-xs text-zinc-500">
                Showing ledger analytics for {rangeLabel}.
              </p>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {DATE_FILTER_OPTIONS.map((option) => {
                const isActive = dateFilter === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setDateFilter(option.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                        : "border-zinc-700 text-zinc-500 bg-zinc-950/40 hover:text-zinc-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {dateFilter === "CUSTOM" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-zinc-500">to</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-sm">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by ID, type, hash, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
            {["ALL", "DEPOSIT", "WITHDRAWAL", "INVENTORY_BUY", "PAYMENT"].map((type) => {
              const isActive = filterType === type;
              let btnColor = "border-zinc-700 text-zinc-400 hover:text-zinc-200";
              if (isActive) {
                if (type === "DEPOSIT") btnColor = "border-emerald-500/40 text-emerald-400 bg-emerald-950/20";
                else if (type === "WITHDRAWAL") btnColor = "border-rose-500/40 text-rose-400 bg-rose-950/20";
                else if (type === "INVENTORY_BUY") btnColor = "border-amber-500/40 text-amber-400 bg-amber-950/20";
                else if (type === "PAYMENT") btnColor = "border-blue-500/40 text-blue-400 bg-blue-950/20";
                else btnColor = "border-emerald-500/40 text-white bg-zinc-800";
              }
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${btnColor}`}
                >
                  {type === "ALL" ? "All" : type === "INVENTORY_BUY" ? "Inventory" : type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          {/* Count */}
          <div className="text-xs text-zinc-500 font-mono shrink-0">
            {filtered.length} / {dateFilteredTransactions.length} txns in range
          </div>
        </div>

        {/* Transaction Table */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/60 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Party / Entity</div>
            <div className="col-span-3">Description / Reason</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2">Tx Hash</div>
            <div className="col-span-2">Date & Time</div>
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-zinc-800/60 max-h-[600px] overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((tx, index) => {
                const config = typeConfig[tx.type] || typeConfig.DEPOSIT;
                const isCredit = tx.type === "DEPOSIT";

                return (
                  <div
                    key={tx.id}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-800/30 transition-colors ${
                      index % 2 === 0 ? "bg-zinc-950/20" : ""
                    }`}
                  >
                    {/* Type Icon */}
                    <div className="col-span-1">
                      <div className={`p-2 rounded-lg w-fit ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                        {config.icon}
                      </div>
                    </div>

                    {/* Party / Entity */}
                    <div className="col-span-2 flex flex-col justify-center">
                      <span className="text-xs font-bold text-white truncate" title={tx.entity || config.defaultEntity}>
                        {tx.entity || config.defaultEntity}
                      </span>
                      <span className={`text-[9px] uppercase font-bold tracking-wider ${config.color}`}>
                        {config.label}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="col-span-3 flex items-center">
                      <span className="text-xs text-zinc-400 font-medium line-clamp-2" title={tx.description || config.defaultDescription}>
                        {tx.description || config.defaultDescription}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="col-span-2 text-right flex flex-col items-end justify-center">
                      <span className={`text-base font-black font-mono ${isCredit ? "text-emerald-400" : "text-rose-400"}`}>
                        {config.sign}₹{tx.amount.toFixed(2)}
                      </span>
                      {tx.type === "DEPOSIT" && (
                        <span className="text-[10px] text-zinc-500 font-semibold font-sans mt-0.5">
                          {getCupsSoldText(tx)}
                        </span>
                      )}
                    </div>

                    {/* Tx Hash */}
                    <div className="col-span-2">
                      {tx.txHash ? (
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-zinc-600 shrink-0" />
                          <span className="text-xs font-mono text-sky-400 truncate cursor-help" title={tx.txHash}>
                            {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-4)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">No hash (internal)</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Clock className="w-3 h-3 text-zinc-600 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-300">{getRelativeTime(tx.timestamp)}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(tx.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Banknote className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-400 font-medium">No transactions found</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {searchQuery || filterType !== "ALL"
                    ? "Try adjusting your search or filter."
                    : "Transactions will appear here as the stand operates or when the date range changes."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Net Summary Footer */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
          {/* Opening balance note */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">
            <div className="p-1.5 bg-violet-500/10 text-violet-400 rounded-lg shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span>
              <span className="text-zinc-300 font-semibold">Opening Balance:</span> ₹{OPENING_BALANCE.toFixed(2)} - This is the seed capital the business started with. Ledger totals below are filtered to {rangeLabel}.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl">
                <DollarSign className="w-5 h-5 text-zinc-950" />
              </div>
              <div>
                <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider block">Treasury Balance</span>
                <span className="text-2xl font-black text-emerald-400">
                  ₹{balance.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  = ₹{OPENING_BALANCE} opening + ₹{totalDeposits.toFixed(0)} in - ₹{(totalWithdrawals + totalInventory + totalPayments).toFixed(0)} out for {rangeLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-zinc-400">
              <div className="flex flex-col items-center gap-1">
                <span className="text-violet-400 font-bold text-lg font-mono">₹{OPENING_BALANCE.toFixed(0)}</span>
                <span className="text-zinc-500">Opening</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-emerald-400 font-bold text-lg font-mono">+₹{totalDeposits.toFixed(0)}</span>
                <span className="text-zinc-500">Total In</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-rose-400 font-bold text-lg font-mono">-₹{(totalWithdrawals + totalInventory + totalPayments).toFixed(0)}</span>
                <span className="text-zinc-500">Total Out</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-white font-bold text-lg font-mono">{dateFilteredTransactions.length}</span>
                <span className="text-zinc-500">Range Txns</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
