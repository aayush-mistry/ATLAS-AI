export type DateFilterKey =
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Timestamped {
  timestamp: string;
}

export interface AnalyticsTransaction extends Timestamped {
  type: "DEPOSIT" | "WITHDRAWAL" | "INVENTORY_BUY" | "PAYMENT";
  amount: number;
  description?: string | null;
  entity?: string | null;
}

export const DATE_FILTER_OPTIONS: Array<{ key: DateFilterKey; label: string }> = [
  { key: "TODAY", label: "Today" },
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "LAST_7_DAYS", label: "Last 7 Days" },
  { key: "THIS_MONTH", label: "This Month" },
  { key: "LAST_MONTH", label: "Last Month" },
  { key: "CUSTOM", label: "Custom Date Range" },
];

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

export const getDateRange = (
  filter: DateFilterKey,
  customStart: string,
  customEnd: string,
  now = new Date()
): DateRange => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (filter === "TODAY") {
    return { from: todayStart, to: todayEnd };
  }

  if (filter === "YESTERDAY") {
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  if (filter === "LAST_7_DAYS") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 6);
    return { from, to: todayEnd };
  }

  if (filter === "THIS_MONTH") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: todayEnd,
    };
  }

  if (filter === "LAST_MONTH") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  const fallbackFrom = todayStart;
  const fallbackTo = todayEnd;
  return {
    from: customStart ? startOfDay(new Date(customStart)) : fallbackFrom,
    to: customEnd ? endOfDay(new Date(customEnd)) : fallbackTo,
  };
};

export const isWithinDateRange = (timestamp: string, range: DateRange) => {
  const time = new Date(timestamp).getTime();
  return time >= range.from.getTime() && time <= range.to.getTime();
};

export const filterByDateRange = <T extends Timestamped>(items: T[], range: DateRange) =>
  items.filter((item) => isWithinDateRange(item.timestamp, range));

export const formatDateRangeLabel = (range: DateRange) => {
  const format = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${format.format(range.from)} - ${format.format(range.to)}`;
};

export const isRevenueTransaction = (tx: AnalyticsTransaction) => {
  const text = `${tx.description ?? ""} ${tx.entity ?? ""}`.toLowerCase();
  return tx.type === "DEPOSIT" && (text.includes("sale") || text.includes("customer") || text.includes("cup"));
};

export const isInvestmentTransaction = (tx: AnalyticsTransaction) =>
  tx.type === "DEPOSIT" && !isRevenueTransaction(tx);

export const summarizeTransactions = (transactions: AnalyticsTransaction[]) => {
  const revenue = transactions
    .filter(isRevenueTransaction)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const investments = transactions
    .filter(isInvestmentTransaction)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = transactions
    .filter((tx) => tx.type === "INVENTORY_BUY" || tx.type === "PAYMENT" || tx.type === "WITHDRAWAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const inventory = transactions
    .filter((tx) => tx.type === "INVENTORY_BUY")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const payouts = transactions
    .filter((tx) => tx.type === "PAYMENT")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const withdrawals = transactions
    .filter((tx) => tx.type === "WITHDRAWAL")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    revenue,
    investments,
    expenses,
    inventory,
    payouts,
    withdrawals,
    profit: revenue - expenses,
    deposits: revenue + investments,
    count: transactions.length,
  };
};

export const MARKET_HOURS = {
  openHour: 9,
  closeHour: 18,
  label: "9:00 AM - 6:00 PM",
};

export const getMarketStatus = (now = new Date()) => {
  const open = new Date(now);
  open.setHours(MARKET_HOURS.openHour, 0, 0, 0);

  const close = new Date(now);
  close.setHours(MARKET_HOURS.closeHour, 0, 0, 0);

  const isOpen = now >= open && now < close;
  const target = isOpen ? close : new Date(open);
  if (!isOpen && now >= close) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1000);

  return {
    isOpen,
    label: isOpen ? "Open" : "Closed",
    countdownLabel: `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    targetLabel: isOpen ? "until market close" : "until next market open",
    hoursLabel: MARKET_HOURS.label,
  };
};
