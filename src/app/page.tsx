"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sun,
  Cloud,
  CloudRain,
  Flame,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Wallet,
  ClipboardList,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  UserPlus,
  Send,
  Copy,
  Plus,
  History,
  Package,
  Cpu,
  Loader2,
  ArrowRight,
  Check,
  TrendingUp,
  Edit2,
  X,
  Power,
  Clock,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  DATE_FILTER_OPTIONS,
  DateFilterKey,
  filterByDateRange,
  formatDateRangeLabel,
  getDateRange,
  getMarketStatus,
  summarizeTransactions,
  toDateInputValue,
} from "@/lib/analytics";

// TypeScript Interfaces to match the Prisma Schema
interface BusinessState {
  id: string;
  shopOpen: boolean;
  walletBalance: number;
  walletAddress: string;
  lemonadePrice: number;
  revenue: number;
  expenses: number;
  profit: number;
  updatedAt: string;
}

interface Inventory {
  id: string;
  item: "Lemons" | "Sugar" | "Cups" | "Ice";
  quantity: number;
  unitCost: number;
}

interface MarketCondition {
  id: string;
  weather: "Sunny" | "Hot" | "Cloudy" | "Rainy";
  lemonPrice: number;
  sugarPrice: number;
  cupPrice: number;
  icePrice: number;
  demandLevel: number;
}

interface User {
  id: string;
  name: string;
  wallet: string;
  role: string;
}

interface Application {
  id: string;
  jobId: string;
  workerId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  worker: User;
  createdAt: string;
}

interface Job {
  id: string;
  title: string;
  payment: number;
  status: "OPEN" | "ASSIGNED" | "COMPLETED" | "PAID";
  workerWallet: string | null;
  applications: Application[];
  createdAt: string;
}

interface Decision {
  id: string;
  action: "BUY_INVENTORY" | "INCREASE_PRICES" | "REDUCE_PRICES" | "HIRE_WORKER" | "PAY_WORKER" | "SAVE_FUNDS";
  reason: string;
  expectedImpact: string;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  message: string;
  timestamp: string;
}

interface Transaction {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "INVENTORY_BUY" | "PAYMENT";
  amount: number;
  txHash: string | null;
  description?: string | null;
  entity?: string | null;
  timestamp: string;
}

export default function Dashboard() {

  // Business Data State
  const [businessState, setBusinessState] = useState<BusinessState | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [market, setMarket] = useState<MarketCondition | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);

  // UI Interactive States
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"system" | "blockchain">("system");
  const [isOracleShifting, setIsOracleShifting] = useState(false);
  const [isCeoTicking, setIsCeoTicking] = useState(false);
  const [ceoMessage, setCeoMessage] = useState<string | null>(null);
  const [showAllDecisions, setShowAllDecisions] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTogglingShop, setIsTogglingShop] = useState(false);
  const [now, setNow] = useState(new Date());
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("TODAY");
  const [customStart, setCustomStart] = useState(toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));

  // Forms
  const [showApplyModal, setShowApplyModal] = useState<string | null>(null); // jobId or null
  const [workerName, setWorkerName] = useState("");
  const [workerWallet, setWorkerWallet] = useState("");
  const [isSubmittingApply, setIsSubmittingApply] = useState(false);

  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobPayment, setNewJobPayment] = useState("200");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [showTreasuryModal, setShowTreasuryModal] = useState(false);
  const [treasuryAction, setTreasuryAction] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [treasuryAmount, setTreasuryAmount] = useState("500");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [isSubmittingTreasury, setIsSubmittingTreasury] = useState(false);

  // Manual pricing states
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(priceInput);
    if (isNaN(parsed) || parsed <= 0) {
      alert("Please enter a valid price greater than 0");
      return;
    }
    setIsUpdatingPrice(true);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditingPrice(false);
        fetchAllData();
      } else {
        alert(data.error || "Failed to update price");
      }
    } catch (err) {
      console.error("Error updating price:", err);
      alert("Error updating price");
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleToggleShop = async () => {
    if (!businessState || isTogglingShop) return;
    const nextShopOpen = !businessState.shopOpen;
    setIsTogglingShop(true);
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopOpen: nextShopOpen }),
      });
      const data = await res.json();
      if (data.success) {
        setBusinessState(data.state);
        setCeoMessage(nextShopOpen
          ? "Business Open: customer purchases and revenue generation are enabled."
          : "Business Closed: customer purchases and sales revenue are paused."
        );
        fetchAllData();
      } else {
        alert(data.error || "Failed to update business status");
      }
    } catch (err) {
      console.error("Error updating business status:", err);
      alert("Error updating business status");
    } finally {
      setIsTogglingShop(false);
    }
  };

  // Fetch state and wallet
  const fetchAllData = async () => {
    try {
      const [stateRes, walletRes] = await Promise.all([
        fetch("/api/state"),
        fetch("/api/wallet"),
      ]);

      const stateData = await stateRes.json();
      const walletData = await walletRes.json();

      if (stateData.success) {
        setBusinessState(stateData.state);
        setInventory(stateData.inventory);
        setMarket(stateData.market);
        setJobs(stateData.jobs);
        setDecisions(stateData.recentDecisions);
        setLogs(stateData.recentLogs);
        setActiveWorkerCount(stateData.activeWorkerCount);
      }

      if (walletData.success) {
        setTransactions(walletData.transactions);
      }
    } catch (error) {
      console.error("Error fetching dashboard telemetry:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mount logic & Polling
  useEffect(() => {
    setMounted(true);
    fetchAllData();
  }, []);

  // Always refresh dashboard telemetry in real-time every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sell cups every 5 seconds when Auto-Syncing is active
  useEffect(() => {
    if (!pollingActive || !businessState?.shopOpen) return;
    const salesInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/sales", { method: "POST" });
        const data = await res.json();
        if (data.success && data.cupsSold > 0) {
          setCeoMessage(`🍋 ${data.msg} (Balance: ₹${data.newBalance.toFixed(2)})`);
          fetchAllData(); // immediately refresh UI
        }
      } catch (err) {
        console.error("Auto sales error:", err);
      }
    }, 5000); // every 5 seconds
    return () => clearInterval(salesInterval);
  }, [pollingActive, businessState?.shopOpen]);

  // Auto-trigger CEO decision every 45 seconds when Auto-Syncing is active
  useEffect(() => {
    if (!pollingActive) return;
    const ceoInterval = setInterval(async () => {
      if (isCeoTicking) return;
      try {
        setCeoMessage("⏳ Auto-tick: AI CEO is analyzing market conditions...");
        const res = await fetch("/api/decision", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          const action = data.decision?.action;
          const msg = data.actionResultMsg || "Tick executed.";
          setCeoMessage(`🤖 Auto CEO: [${action}]. ${msg}`);
          fetchAllData();
        }
      } catch (err) {
        console.error("Auto CEO tick error:", err);
      }
    }, 45000); // every 45 seconds
    return () => clearInterval(ceoInterval);
  }, [pollingActive, isCeoTicking]);

  // Copy wallet address helper
  const copyAddress = () => {
    if (!businessState?.walletAddress) return;
    navigator.clipboard.writeText(businessState.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Oracle trigger
  const triggerOracleShift = async () => {
    setIsOracleShifting(true);
    try {
      const res = await fetch("/api/market", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMarket(data.market);
        fetchAllData();
      }
    } catch (err) {
      console.error("Oracle shift fail:", err);
    } finally {
      setIsOracleShifting(false);
    }
  };

  // AI CEO Tick trigger
  const triggerCeoTick = async () => {
    setIsCeoTicking(true);
    setCeoMessage("AI CEO is analyzing stand telemetry and market conditions...");
    try {
      const res = await fetch("/api/decision", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const action = data.decision?.action;
        const msg = data.actionResultMsg || "Tick executed.";
        
        setCeoMessage(`CEO decided to: [${action}]. ${msg}`);
        fetchAllData();
      } else {
        setCeoMessage(`CEO Tick execution error: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("CEO tick fail:", err);
      setCeoMessage(`CEO Tick failed: ${err.message}`);
    } finally {
      setIsCeoTicking(false);
    }
  };

  // Worker apply action
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApplyModal || !workerName || !workerWallet) return;
    setIsSubmittingApply(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPLY",
          jobId: showApplyModal,
          workerName,
          workerWallet,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowApplyModal(null);
        setWorkerName("");
        setWorkerWallet("");
        fetchAllData();
      } else {
        alert(data.error || "Failed to apply.");
      }
    } catch (err) {
      console.error("Apply error:", err);
    } finally {
      setIsSubmittingApply(false);
    }
  };

  // Worker declare completion
  const declareComplete = async (jobId: string) => {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "COMPLETE",
          jobId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      } else {
        alert(data.error || "Failed to complete job.");
      }
    } catch (err) {
      console.error("Complete error:", err);
    }
  };

  // Create Job
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle || !newJobPayment) return;
    setIsSubmittingCreate(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          title: newJobTitle,
          payment: parseFloat(newJobPayment),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateJobModal(false);
        setNewJobTitle("");
        setNewJobPayment("200");
        fetchAllData();
      } else {
        alert(data.error || "Failed to create job.");
      }
    } catch (err) {
      console.error("Create job error:", err);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Treasury Deposit/Withdraw
  const handleTreasuryAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treasuryAmount) return;
    setIsSubmittingTreasury(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: treasuryAction,
          amount: parseFloat(treasuryAmount),
          toAddress: treasuryAction === "WITHDRAWAL" ? treasuryAddress : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowTreasuryModal(false);
        setTreasuryAmount("500");
        setTreasuryAddress("");
        fetchAllData();
      } else {
        alert(data.error || "Transaction declined.");
      }
    } catch (err) {
      console.error("Treasury action error:", err);
    } finally {
      setIsSubmittingTreasury(false);
    }
  };

  // Populate realistic mock wallet address for user testing
  const autofillMockWallet = () => {
    const chars = "0123456789abcdef";
    let mock = "0x";
    for (let i = 0; i < 40; i++) {
      mock += chars[Math.floor(Math.random() * 16)];
    }
    setWorkerWallet(mock);
  };

  // Weather styling maps
  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case "Sunny":
        return <Sun className="w-10 h-10 text-amber-400 animate-spin-slow" />;
      case "Hot":
        return <Flame className="w-10 h-10 text-orange-500 animate-pulse" />;
      case "Cloudy":
        return <Cloud className="w-10 h-10 text-zinc-400" />;
      case "Rainy":
        return <CloudRain className="w-10 h-10 text-sky-400 animate-bounce" />;
      default:
        return <Sun className="w-10 h-10 text-amber-400" />;
    }
  };

  // Calculate historical balances for chart
  const getChartData = (sourceTransactions = transactions) => {
    const currentBalance = businessState?.walletBalance ?? 0;
    if (!sourceTransactions || sourceTransactions.length === 0) {
      return [{ name: "Now", balance: currentBalance }];
    }

    // Sort transactions by date ascending
    const sorted = [...sourceTransactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Reverse-calculate the initial balance BEFORE any transactions.
    // The current walletBalance already reflects all transactions,
    // so we undo them to find what the balance was at the start.
    let initialBalance = currentBalance;
    sorted.forEach((tx) => {
      if (tx.type === "DEPOSIT") {
        initialBalance -= tx.amount; // undo deposit
      } else {
        initialBalance += tx.amount; // undo withdrawal/payment/buy
      }
    });

    // Now replay transactions forward from the initial balance
    let running = initialBalance;
    const history = [{ name: "Init", balance: running }];

    sorted.forEach((tx) => {
      if (tx.type === "DEPOSIT") {
        running += tx.amount;
      } else {
        running -= tx.amount;
      }
      const time = new Date(tx.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      history.push({ name: time, balance: running });
    });

    return history;
  };

  // Get decision history chart data
  const getDecisionChartData = (sourceDecisions = decisions) => {
    // Reverse decisions to show chronologically (oldest to newest)
    const sorted = [...sourceDecisions].reverse();
    return sorted.map((d, idx) => {
      const text = d.expectedImpact;
      let val = 0;
      
      if (d.action === "SAVE_FUNDS") {
        val = 0;
      } else {
        const priceRangeMatch = text.match(/(increased|reduced|price).*?₹(\d+(?:\.\d+)?).*?₹(\d+(?:\.\d+)?)/i);
        if (priceRangeMatch) {
          const v1 = parseFloat(priceRangeMatch[2]);
          const v2 = parseFloat(priceRangeMatch[3]);
          const diff = Math.abs(v2 - v1);
          const isIncrease = priceRangeMatch[1].toLowerCase().includes("increas");
          val = isIncrease ? diff : -diff;
        } else {
          const matchSymbol = text.match(/₹(\d+(?:\.\d+)?)/);
          if (matchSymbol && matchSymbol[1]) {
            val = parseFloat(matchSymbol[1]);
          } else {
            const matchNumber = text.match(/(\d+(?:\.\d+)?)/);
            if (matchNumber && matchNumber[1]) {
              val = parseFloat(matchNumber[1]);
            }
          }
          
          const lower = text.toLowerCase();
          const isNegative =
            d.action === "BUY_INVENTORY" ||
            d.action === "PAY_WORKER" ||
            d.action === "HIRE_WORKER" ||
            d.action === "REDUCE_PRICES" ||
            lower.includes("decrease") ||
            lower.includes("spend") ||
            lower.includes("reduced") ||
            lower.includes("cost") ||
            lower.includes("loss");
            
          if (isNegative) val = -val;
        }
      }

      const timeStr = new Date(d.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      return {
        id: d.id,
        index: idx + 1,
        time: timeStr,
        action: d.action,
        impact: val,
        reason: d.reason,
        expectedImpactText: d.expectedImpact,
        timestamp: d.timestamp,
      };
    });
  };




  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-200">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-lg font-medium tracking-wide">Syncing with Autonomous Stand Ledger...</p>
      </div>
    );
  }

  // Active worker status helpers
  const isStandOpen = activeWorkerCount > 0;
  const isShopOpen = businessState?.shopOpen ?? false;
  const isBusinessOperating = isShopOpen && isStandOpen;
  const currentPrice = businessState?.lemonadePrice ?? 25;
  const analyticsRange = getDateRange(dateFilter, customStart, customEnd, now);
  const filteredTransactions = filterByDateRange(transactions, analyticsRange);
  const filteredDecisions = filterByDateRange(decisions, analyticsRange);
  const filteredLogs = filterByDateRange(logs, analyticsRange);
  const analyticsSummary = summarizeTransactions(filteredTransactions);
  const currentNetProfit = analyticsSummary.profit;
  const marketStatus = getMarketStatus(now);
  const rangeLabel = formatDateRangeLabel(analyticsRange);

  return (
    <div className="spatial-shell flex flex-col flex-1 bg-zinc-950 text-zinc-100 font-sans min-h-screen">
      {/* Background Glowing Ambient Accents */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-blue-500/5 rounded-full filter blur-[80px] pointer-events-none" />

      {/* HEADER SECTION */}
      <header className="border-b border-zinc-800 bg-zinc-900/40 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10">
              <Cpu className="w-6 h-6 text-zinc-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                ALTAS
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v1.0
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Autonomous Legal Entity AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Shop Open/Close Toggle */}
            <button
              onClick={handleToggleShop}
              disabled={isTogglingShop || !businessState}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black border transition-all shadow-lg disabled:opacity-50 ${
                isShopOpen
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500 hover:text-white shadow-rose-500/10"
                  : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
              }`}
              title={isShopOpen ? "Close shop and pause customer sales" : "Open shop and resume customer sales"}
            >
              {isTogglingShop ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              {isShopOpen ? "Close Shop" : "Open Shop"}
            </button>

            {/* Polling Toggle */}
            <button
              onClick={() => setPollingActive(!pollingActive)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                pollingActive
                  ? "bg-zinc-800/80 border-emerald-500/30 text-emerald-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pollingActive ? "animate-spin" : ""}`} />
              {pollingActive ? "Auto-Syncing" : "Paused"}
            </button>

            {/* Stand Status badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${
                isShopOpen
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-950/20 border-rose-500/30 text-rose-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isShopOpen ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
              {isShopOpen ? "BUSINESS OPEN" : "BUSINESS CLOSED"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        
        {!isShopOpen && (
          <div className="bg-rose-950/30 border border-rose-500/30 text-rose-200 px-6 py-4 rounded-2xl flex items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-black text-white">Business Closed</p>
                <p className="text-xs text-rose-200/80">
                  Customer purchases and sales revenue are paused until the shop is reopened.
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleShop}
              disabled={isTogglingShop}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
            >
              Open Shop
            </button>
          </div>
        )}

        {/* MANUAL TRIGGERS & MESSAGES */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className={`w-5 h-5 ${isShopOpen ? "text-emerald-400" : "text-rose-400"} animate-pulse shrink-0`} />
            <div className="text-sm">
              <span className="font-semibold text-zinc-300">Operational Controls:</span>{" "}
              <span className="text-zinc-400">
                {isShopOpen
                  ? "AI CEO updates are automated but can be triggered manually to run decisions immediately."
                  : "Business Closed. AI CEO controls remain available, but customer purchases are blocked."}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
            <button
              onClick={triggerOracleShift}
              disabled={isOracleShifting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isOracleShifting ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <RefreshCw className="w-4 h-4 text-zinc-400" />
              )}
              Change Weather
            </button>
            <button
              onClick={triggerCeoTick}
              disabled={isCeoTicking}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              {isCeoTicking ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Cpu className="w-4 h-4 text-white" />
              )}
              Trigger AI CEO Tick
            </button>
          </div>
        </div>

        {/* CEO MSG FEEDBACK */}
        {ceoMessage && (
          <div className="latest-result-panel border text-sm px-6 py-4 rounded-2xl flex items-start gap-3 shadow-md">
            <CheckCircle2 className="latest-result-icon w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="latest-result-label font-semibold">Latest Operational Result:</span>
              <p className="latest-result-message mt-1">{ceoMessage}</p>
            </div>
          </div>
        )}

        {/* ANALYTICS DATE RANGE FILTER */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Analytics Range</p>
                <p className="text-xs text-zinc-500">
                  Filters transactions, profit and loss, revenue, expenses, investments, and AI actions for {rangeLabel}.
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
        </div>

        {/* METRICS ROW */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
          {/* Treasury Wallet Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet className="w-24 h-24 text-white" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Treasury Balance</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ₹{(businessState?.walletBalance ?? 0).toFixed(2)}
            </div>
            
            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-800/80">
              <button
                onClick={copyAddress}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Copy treasury smart contract address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="font-mono">
                  {businessState?.walletAddress.slice(0, 6)}...{businessState?.walletAddress.slice(-4)}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <Link
                  href="/transactions"
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Ledger <History className="w-3" />
                </Link>
                <button
                  onClick={() => setShowTreasuryModal(true)}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Transact <ArrowRight className="w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Net Profit Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Net Profit / Loss</span>
              <div
                className={`p-2 rounded-lg border ${
                  currentNetProfit >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {currentNetProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                currentNetProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              ₹{currentNetProfit.toFixed(2)}
            </div>
            <p className="text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80">
              Profit and loss for {rangeLabel}
            </p>
          </div>

          {/* Revenue vs Expenses */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Revenue / Expenses</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white flex items-baseline gap-2 mb-2">
              <span className="text-emerald-400">₹{analyticsSummary.revenue.toFixed(0)}</span>
              <span className="text-zinc-500 text-sm">/</span>
              <span className="text-zinc-400">₹{analyticsSummary.expenses.toFixed(0)}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-5 pt-3 border-t border-zinc-800/80">
              Filtered revenue versus expenses across {filteredTransactions.length} transactions
            </p>
          </div>

          {/* Pricing Model */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Price Per Cup</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {isEditingPrice ? (
              <form onSubmit={handleUpdatePrice} className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-24 px-2 py-1 text-sm bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-amber-400 font-mono"
                  disabled={isUpdatingPrice}
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  disabled={isUpdatingPrice}
                  title="Save price"
                >
                  {isUpdatingPrice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPrice(false)}
                  className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/25 transition-colors disabled:opacity-50"
                  disabled={isUpdatingPrice}
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-3xl font-bold text-amber-400">
                  ₹{currentPrice.toFixed(2)}
                </span>
                <button
                  onClick={() => {
                    setPriceInput(currentPrice.toString());
                    setIsEditingPrice(true);
                  }}
                  className="p-1 bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
                  title="Change price manually"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80">
              {isShopOpen ? "Regulated dynamically by CEO based on weather, or changed manually" : "Business Closed: price retained for reopening"}
            </p>
          </div>

          {/* Investments */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Investments</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-purple-400 mb-2">
              ₹{analyticsSummary.investments.toFixed(2)}
            </div>
            <p className="text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80">
              Non-sale deposits in {rangeLabel}; ready for a dedicated API field later.
            </p>
          </div>

          {/* Market Status */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-sm font-medium">Market Status</span>
              <div
                className={`p-2 rounded-lg border ${
                  marketStatus.isOpen
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-3xl font-bold mb-2 ${marketStatus.isOpen ? "text-emerald-400" : "text-rose-400"}`}>
              {marketStatus.label}
            </div>
            <div className="text-sm font-black text-white font-mono">
              {marketStatus.countdownLabel}
            </div>
            <p className="text-xs text-zinc-500 mt-4 pt-3 border-t border-zinc-800/80">
              {marketStatus.targetLabel}. Hours: {marketStatus.hoursLabel}
            </p>
          </div>
        </section>

        <section className={`border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isBusinessOperating
            ? "bg-emerald-950/10 border-emerald-500/20"
            : isShopOpen
              ? "bg-amber-950/10 border-amber-500/20"
              : "bg-rose-950/20 border-rose-500/20"
        }`}>
          <div>
            <h2 className="text-sm font-black text-white">
              {isBusinessOperating ? "Business Open" : isShopOpen ? "Business Open, Worker Needed" : "Business Closed"}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {isBusinessOperating
                ? "Customer purchases, revenue generation, and normal operations are enabled."
                : isShopOpen
                  ? "The shop is open, but sales wait for an assigned worker."
                  : "Customer purchases and the sales API are blocked until the shop reopens."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isShopOpen
                ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/30"
                : "bg-rose-950/30 text-rose-400 border-rose-500/30"
            }`}>
              {isShopOpen ? "Business Open" : "Business Closed"}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isStandOpen
                ? "bg-blue-950/30 text-blue-400 border-blue-500/30"
                : "bg-zinc-900 text-zinc-500 border-zinc-700"
            }`}>
              {isStandOpen ? "Worker Active" : "No Active Worker"}
            </span>
          </div>
        </section>

        {/* MIDDLE SECTION - OPERATIONS CENTER & INVENTORY/CHARTS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: CEO OPERATIONS CENTER (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Last Decision Panel */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex-1 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  AI CEO Operations Desk
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAllDecisions(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                    title="View full decision history and analytics"
                  >
                    <History className="w-3.5 h-3.5" /> History
                  </button>
                  <button
                    onClick={fetchAllData}
                    disabled={loading}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    title="Refresh decisions"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </h2>

              {filteredDecisions.length > 0 ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-5 mb-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500">
                        Current Action State
                      </span>
                      <span className="px-3 py-1 text-xs font-bold rounded-lg border bg-zinc-900 text-emerald-400 border-emerald-500/20">
                        {filteredDecisions[0].action}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-zinc-200 mb-4 leading-relaxed">
                      &quot;{filteredDecisions[0].reason}&quot;
                    </div>
                    <div className="border-t border-zinc-800/80 pt-3">
                      <span className="text-xs font-semibold text-zinc-400 block mb-1">Expected Financial Impact:</span>
                      <p className="text-xs text-zinc-500 leading-relaxed">{filteredDecisions[0].expectedImpact}</p>
                    </div>
                  </div>

                  {/* Decision Timeline Feed */}
                  <div>
                    <h3 className="text-xs uppercase tracking-wider font-bold text-zinc-500 mb-3 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Executive Log History ({rangeLabel})
                    </h3>
                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2">
                      {filteredDecisions.slice(1, 4).map((d) => (
                        <div key={d.id} className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/20 hover:bg-zinc-950/40 text-xs transition-colors">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-zinc-300">{d.action}</span>
                            <p className="text-zinc-500 line-clamp-1">{d.reason}</p>
                          </div>
                          <span className="text-zinc-600 font-mono text-[10px] shrink-0">
                            {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-950/40 border border-zinc-800 border-dashed rounded-xl">
                  <Cpu className="w-8 h-8 text-zinc-600 mb-3 animate-pulse" />
                  <p className="text-sm font-medium text-zinc-400">No AI actions in this range.</p>
                  <p className="text-xs text-zinc-600 mt-1">Change the date filter or trigger the AI CEO Tick.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: INVENTORY STATUS & CHART (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Inventory Status Panel */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Raw Inventory levels
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {["Lemons", "Sugar", "Cups", "Ice"].map((name) => {
                  const invItem = inventory.find((i) => i.item === name);
                  const qty = invItem?.quantity ?? 0;
                  // Max limits for styling percentage
                  const maxLimit = name === "Ice" ? 300 : 200;
                  const pct = Math.min(100, (qty / maxLimit) * 100);
                  
                  // Color levels
                  let colorClass = "bg-emerald-500 shadow-emerald-500/20";
                  let borderClass = "border-emerald-500/30";
                  if (qty < 50) {
                    colorClass = "bg-rose-500 shadow-rose-500/20";
                    borderClass = "border-rose-500/30";
                  } else if (qty < 90) {
                    colorClass = "bg-amber-500 shadow-amber-500/20";
                    borderClass = "border-amber-500/30";
                  }

                  // Market rate
                  let rate = 0;
                  if (market) {
                    if (name === "Lemons") rate = market.lemonPrice;
                    else if (name === "Sugar") rate = market.sugarPrice;
                    else if (name === "Cups") rate = market.cupPrice;
                    else if (name === "Ice") rate = market.icePrice;
                  }

                  return (
                    <div key={name} className={`bg-zinc-950/40 p-4 border rounded-xl ${borderClass}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-zinc-300">{name}</span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {qty} <span className="text-[10px] text-zinc-600">/ {maxLimit}</span>
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-2">
                        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-zinc-500 flex justify-between">
                        <span>Cost: ₹{rate.toFixed(2)}/u</span>
                        {qty < 50 && <span className="text-rose-400 font-semibold animate-pulse">Low Stock</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weather Oracle Panel */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sun className="w-5 h-5 text-sky-400" />
                  Market Weather Oracle
                </h2>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-950 text-zinc-400 border border-zinc-800">
                  Oracle Node
                </span>
              </div>

              {market ? (
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-2xl shadow-inner shrink-0">
                    {getWeatherIcon(market.weather)}
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-white mb-1">
                      {market.weather}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Customer Demand Level:</span>
                        <span className="text-sky-400 font-bold font-mono">{Math.round(market.demandLevel * 100)}%</span>
                      </div>
                      {/* Demand progress meter */}
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${market.demandLevel * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-xs italic">Oracle data not loaded.</div>
              )}
            </div>
          </div>
        </section>

        {/* PERFORMANCE CHART */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Treasury Balance Evolution ({rangeLabel})
          </h2>
          <div className="w-full h-64">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData(filteredTransactions)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="#8b919d" fontSize={10} tickLine={false} />
                  <YAxis stroke="#8b919d" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0b0d10", borderColor: "rgba(255,255,255,0.1)", color: "#f7f8fb" }}
                    labelStyle={{ color: "#a7adb7", fontSize: 11 }}
                    itemStyle={{ color: "#8b63ff" }}
                    formatter={(value) => value !== undefined && value !== null ? [`₹${parseFloat(value.toString()).toFixed(2)}`, "Wallet Balance"] : ["₹0.00", "Wallet Balance"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#8b63ff"
                    strokeWidth={3}
                    dot={{ fill: "#8b63ff", strokeWidth: 1 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                Rendering live chart...
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM SECTION - JOB BOARD & ACTIVITY LOGS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* JOB BOARD (7 columns) */}
          <div className="lg:col-span-7 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                  Decentralized Job Board
                </h2>
                <p className="text-xs text-zinc-500">
                  AI CEO locks payouts in Escrow contracts; workers complete tasks to release funds
                </p>
              </div>
              <button
                onClick={() => setShowCreateJobModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/15 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Post Job
              </button>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 flex-1">
              {jobs.length > 0 ? (
                jobs.map((job) => {
                  const hasApplied = job.applications.length > 0;
                  
                  // Status badge map
                  let statusBadge = "bg-zinc-800 text-zinc-400 border-zinc-700";
                  if (job.status === "OPEN") statusBadge = "bg-blue-950/20 text-blue-400 border-blue-500/20";
                  else if (job.status === "ASSIGNED") statusBadge = "bg-amber-950/20 text-amber-400 border-amber-500/20";
                  else if (job.status === "COMPLETED") statusBadge = "bg-purple-950/20 text-purple-400 border-purple-500/20";
                  else if (job.status === "PAID") statusBadge = "bg-emerald-950/20 text-emerald-400 border-emerald-500/20";

                  return (
                    <div
                      key={job.id}
                      className="border border-zinc-850 bg-zinc-950/30 rounded-xl p-5 hover:bg-zinc-950/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border uppercase ${statusBadge}`}>
                            {job.status}
                          </span>
                          <span className="text-xs font-mono text-zinc-500">
                            ID: {job.id.slice(0, 6)}...
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-base leading-tight mb-2">
                          {job.title}
                        </h3>
                        {job.workerWallet && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono mb-2">
                            <Wallet className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Assigned Worker:</span>
                            <span className="text-zinc-300">
                              {job.workerWallet.slice(0, 8)}...{job.workerWallet.slice(-6)}
                            </span>
                          </div>
                        )}
                        
                        {/* Pending applications count */}
                        {job.status === "OPEN" && (
                          <div className="text-xs text-zinc-500">
                            {job.applications.length} applications pending review
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-850">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Payout Escrow</span>
                          <span className="text-lg font-black text-emerald-400 font-mono">
                            ₹{job.payment.toFixed(2)}
                          </span>
                        </div>

                        {/* Action buttons based on status */}
                        {job.status === "OPEN" && (
                          <button
                            onClick={() => {
                              setShowApplyModal(job.id);
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600/10 text-blue-400 border border-blue-500/25 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                          >
                            Apply for Job
                          </button>
                        )}

                        {job.status === "ASSIGNED" && (
                          <button
                            onClick={() => declareComplete(job.id)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600/10 text-amber-400 border border-amber-500/25 hover:bg-amber-600 hover:text-zinc-950 transition-all cursor-pointer"
                          >
                            Complete Job
                          </button>
                        )}

                        {job.status === "COMPLETED" && (
                          <span className="text-xs text-purple-400 italic font-semibold">
                            Awaiting AI Release
                          </span>
                        )}

                        {job.status === "PAID" && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Payout Released
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                  <ClipboardList className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400 font-medium">No marketplace jobs active.</p>
                  <p className="text-xs text-zinc-600 mt-1">Post a job to recruit lemon squeeze workers.</p>
                </div>
              )}
            </div>
          </div>

          {/* AUDIT LOG & BLOCKCHAIN LEDGER (5 columns) */}
          <div className="lg:col-span-5 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            {/* Tabs */}
            <div className="flex border-b border-zinc-850 mb-4 pb-1">
              <button
                onClick={() => setActiveTab("system")}
                className={`flex-1 text-center pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "system"
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  System Logs
                </div>
              </button>
              <button
                onClick={() => setActiveTab("blockchain")}
                className={`flex-1 text-center pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "blockchain"
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <History className="w-4 h-4" />
                  Blockchain Ledger
                </div>
              </button>
            </div>

            {/* TAB CONTENT: SYSTEM LOGS */}
            {activeTab === "system" && (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 flex-1 scrollbar-thin">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="text-xs p-3 rounded-xl border border-zinc-850 bg-zinc-950/40 leading-relaxed text-zinc-300">
                      <div className="text-[10px] text-zinc-500 mb-1 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      {log.message}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-zinc-600 text-xs italic">
                    No activity logs in this range.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: BLOCKCHAIN LEDGER */}
            {activeTab === "blockchain" && (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 flex-1 scrollbar-thin">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => {
                    let typeColor = "text-emerald-400 bg-emerald-950/20 border-emerald-500/10";
                    if (tx.type === "WITHDRAWAL") typeColor = "text-rose-400 bg-rose-950/20 border-rose-500/10";
                    else if (tx.type === "INVENTORY_BUY") typeColor = "text-amber-400 bg-amber-950/20 border-amber-500/10";
                    else if (tx.type === "PAYMENT") typeColor = "text-blue-400 bg-blue-950/20 border-blue-500/10";

                    return (
                      <div key={tx.id} className="p-3 border border-zinc-850 bg-zinc-950/30 rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${typeColor}`}>
                            {tx.type}
                          </span>
                          <span className="text-xs font-black font-mono text-white">
                            ₹{tx.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate mb-1">
                          Timestamp: {new Date(tx.timestamp).toLocaleString()}
                        </div>
                        {tx.txHash && (
                          <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between border-t border-zinc-850/50 pt-1.5 mt-1">
                            <span className="text-zinc-600 text-[9px]">Tx Hash:</span>
                            <span className="text-sky-400 cursor-help underline" title="Mock Polygon scan address link">
                              {tx.txHash.slice(0, 16)}...
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-zinc-600 text-xs italic">
                    No block transactions in this range.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* APPLICANT FORM MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Apply as Lemon Stand Worker
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter worker identity credentials to register a smart contract application.
            </p>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Worker Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase text-zinc-400">Web3 Wallet Address</label>
                  <button
                    type="button"
                    onClick={autofillMockWallet}
                    className="text-[10px] text-blue-400 hover:underline font-semibold"
                  >
                    Autofill Mock Address
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={workerWallet}
                  onChange={(e) => setWorkerWallet(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingApply}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/10"
                >
                  {isSubmittingApply ? "Sending Apply..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE JOB MODAL */}
      {showCreateJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              Post a Marketplace Job
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Add new worker openings to the decentralized board. AI CEO will manage hiring contracts.
            </p>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Squeeze 100 lemons & organize cup stacks"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Escrow Payout (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="250"
                  value={newJobPayment}
                  onChange={(e) => setNewJobPayment(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/10"
                >
                  {isSubmittingCreate ? "Posting Job..." : "Publish Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TREASURY TRANSACTION MODAL */}
      {showTreasuryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Manage Treasury Funds
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Simulate funds injection or withdraw liquidity from the corporate treasury.
            </p>
            <form onSubmit={handleTreasuryAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Action Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTreasuryAction("DEPOSIT")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      treasuryAction === "DEPOSIT"
                        ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/40"
                        : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    Deposit Funds
                  </button>
                  <button
                    type="button"
                    onClick={() => setTreasuryAction("WITHDRAWAL")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      treasuryAction === "WITHDRAWAL"
                        ? "bg-rose-950/20 text-rose-400 border-rose-500/40"
                        : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    Withdraw Funds
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="500"
                  value={treasuryAmount}
                  onChange={(e) => setTreasuryAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {treasuryAction === "WITHDRAWAL" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">Recipient Wallet (Optional)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={treasuryAddress}
                    onChange={(e) => setTreasuryAddress(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTreasuryModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTreasury}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-950 transition-colors shadow-lg ${
                    treasuryAction === "DEPOSIT"
                      ? "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/10"
                      : "bg-rose-500 hover:bg-rose-400 shadow-rose-500/10 text-white"
                  }`}
                >
                  {isSubmittingTreasury ? "Confirming..." : "Execute Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DECISION HISTORY MODAL */}
      {showAllDecisions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10">
                  <History className="w-5 h-5 text-zinc-950" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    AI CEO Executive Decisions Log
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Comprehensive audit trail and expected impact analysis for {rangeLabel}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllDecisions(false)}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden flex-1">
              {/* Left Column: Impact Chart */}
              <div className="lg:col-span-5 flex flex-col bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-5">
                <h4 className="text-xs uppercase tracking-wider font-bold text-zinc-400 mb-4 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Decision Impact Distribution
                </h4>
                <div className="flex-1 min-h-[250px] flex items-center justify-center">
                  {filteredDecisions.length > 0 ? (
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getDecisionChartData(filteredDecisions)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="index" stroke="#8b919d" fontSize={10} tickLine={false} />
                          <YAxis stroke="#8b919d" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl max-w-xs shadow-xl text-xs space-y-1.5">
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="font-bold text-white">{data.action}</span>
                                      <span className="text-zinc-500 font-mono text-[10px]">{data.time}</span>
                                    </div>
                                    <p className="text-zinc-400 line-clamp-2">{data.reason}</p>
                                    <div className="border-t border-zinc-800/80 pt-1.5 flex justify-between items-center">
                                      <span className="text-[10px] text-zinc-500">Proj. Impact:</span>
                                      <span className={`font-bold ${data.impact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {data.impact >= 0 ? "+" : ""}₹{data.impact.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                          <Bar dataKey="impact">
                            {getDecisionChartData(filteredDecisions).map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.impact >= 0 ? "#28c7df" : "#ff4c5b"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-600 italic">No metrics to display.</span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mt-4 leading-relaxed bg-zinc-900/60 p-3 border border-zinc-800 rounded-lg">
                  <span className="font-bold text-zinc-400 block mb-0.5">Note on Impact Calculation:</span>
                  Impact values represent parsed cash flow adjustments (e.g., expenses incurred for purchases/payouts, or expected price changes) derived from the CEO's projection statements.
                </div>
              </div>

              {/* Right Column: Scrollable List of Decisions */}
              <div className="lg:col-span-7 flex flex-col overflow-hidden">
                <h4 className="text-xs uppercase tracking-wider font-bold text-zinc-400 mb-4 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-blue-400" />
                  Detailed Executive Audit Trail ({filteredDecisions.length} actions)
                </h4>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                  {filteredDecisions.map((d, index) => {
                    const parsedData = getDecisionChartData(filteredDecisions);
                    const parsed = parsedData.find(item => item.id === d.id);
                    const parsedImpact = parsed ? parsed.impact : 0;
                    
                    let actionBadge = "bg-zinc-800 text-zinc-400 border-zinc-700";
                    if (d.action === "BUY_INVENTORY") actionBadge = "bg-amber-950/20 text-amber-400 border-amber-500/20";
                    else if (d.action === "INCREASE_PRICES") actionBadge = "bg-emerald-950/20 text-emerald-400 border-emerald-500/20";
                    else if (d.action === "REDUCE_PRICES") actionBadge = "bg-rose-950/20 text-rose-400 border-rose-500/20";
                    else if (d.action === "HIRE_WORKER") actionBadge = "bg-blue-950/20 text-blue-400 border-blue-500/20";
                    else if (d.action === "PAY_WORKER") actionBadge = "bg-purple-950/20 text-purple-400 border-purple-500/20";
                    else if (d.action === "SAVE_FUNDS") actionBadge = "bg-zinc-900/60 text-zinc-350 border-zinc-800";

                    return (
                      <div
                        key={d.id}
                        className="border border-zinc-850 bg-zinc-950/30 rounded-xl p-4 hover:bg-zinc-950/60 transition-colors flex flex-col gap-3 relative"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              #{filteredDecisions.length - index}
                            </span>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border uppercase ${actionBadge}`}>
                              {d.action}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {new Date(d.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-0.5">Rationale:</span>
                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            &quot;{d.reason}&quot;
                          </p>
                        </div>

                        <div className="flex items-start justify-between gap-4 pt-2 border-t border-zinc-800/50 flex-wrap lg:flex-nowrap">
                          <div className="flex-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-0.5">Projected Result:</span>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {d.expectedImpact}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-0.5">Parsed Impact</span>
                            <span className={`text-sm font-black font-mono ${parsedImpact >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {parsedImpact >= 0 ? "+" : ""}₹{parsedImpact.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
