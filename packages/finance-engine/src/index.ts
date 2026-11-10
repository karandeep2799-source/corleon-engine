/**
 * Shared finance intelligence domain layer.
 * Monetary values are integer paise to avoid floating-point currency errors.
 */
export type Transaction = {
  id: string;
  date: string;
  description: string;
  amountPaise: number;
  rewardPoints: number;
  category: string;
  source?: string;
};
export type CategoryRule = { name: string; patterns: string[] };
export type MonthlySummary = {
  month: string;
  spendPaise: number;
  creditsPaise: number;
  netSpendPaise: number;
  transactionCount: number;
  categories: Record<string, number>;
};
export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  { name: "Food & Dining", patterns: ["SWIGGY", "ZOMATO", "BLINKIT", "INSTAMART", "DOMINOS", "KFC", "MCDONALDS", "STARBUCKS"] },
  { name: "Travel", patterns: ["UBER", "OLA", "IRCTC", "MAKEMYTRIP", "TRIP.COM", "CLEARTRIP", "GOIBIBO"] },
  { name: "Shopping", patterns: ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "NYKAA", "MEESHO"] },
  { name: "Entertainment", patterns: ["NETFLIX", "SPOTIFY", "GOOGLE PLAY", "APPLE", "HOTSTAR", "PRIME VIDEO"] },
  { name: "Utilities", patterns: ["BESCOM", "BWSSB", "JIO", "AIRTEL", "VODAFONE", "TATA PLAY"] },
  { name: "Groceries", patterns: ["BIGBASKET", "DMART", "MORE", "RELIANCE FRESH", "SPAR"] },
  { name: "Fuel", patterns: ["IOCL", "BPCL", "HPCL", "SHELL", "INDIAN OIL"] },
  { name: "Healthcare", patterns: ["PHARMACY", "APOLLO", "MEDPLUS", "HOSPITAL", "CLINIC"] },
  { name: "Finance & Fees", patterns: ["IGST", "GST", "FINANCE CHARGES", "LATE FEE", "DCC TRANSACTION"] },
];
export function toPaise(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value.replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(parsed)) throw new Error("Invalid transaction amount");
  return Math.round(parsed * 100);
}
export function categorize(description: string, rules = DEFAULT_CATEGORY_RULES): string {
  const normalized = description.normalize("NFKC").toLocaleUpperCase("en-IN");
  return rules.find(rule => rule.patterns.some(pattern => normalized.includes(pattern.toLocaleUpperCase("en-IN"))))?.name ?? "Uncategorized";
}
export function normalizeTransaction(input: { date: string; description: string; amount: string | number; rewardPoints?: number; id?: string; source?: string }): Transaction {
  const date = new Date(input.date);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid transaction date");
  const description = input.description.trim().replace(/\s+/g, " ");
  if (!description || description.length > 500) throw new Error("Invalid transaction description");
  const amountPaise = toPaise(input.amount);
  const rewardPoints = input.rewardPoints ?? 0;
  if (!Number.isSafeInteger(rewardPoints)) throw new Error("Invalid reward points");
  return {
    id: input.id ?? crypto.randomUUID(),
    date: date.toISOString(),
    description,
    amountPaise,
    rewardPoints,
    category: categorize(description),
    source: input.source,
  };
}
export function isCardPayment(description: string): boolean {
  return /CREDIT CARD PAYMENT|\bCC PAYMENT\b|NETBANKING TRANSFER/i.test(description);
}
export function summarize(transactions: Transaction[]): { totalSpendPaise: number; totalCreditsPaise: number; netSpendPaise: number; totalRewardPoints: number; transactionCount: number; monthly: MonthlySummary[]; categoryTotals: Record<string, number> } {
  const months = new Map<string, MonthlySummary>();
  let totalSpendPaise = 0, totalCreditsPaise = 0, totalRewardPoints = 0;
  const categoryTotals: Record<string, number> = {};
  for (const tx of transactions) {
    totalRewardPoints += tx.rewardPoints;
    if (isCardPayment(tx.description)) continue;
    const month = tx.date.slice(0, 7);
    const row = months.get(month) ?? { month, spendPaise: 0, creditsPaise: 0, netSpendPaise: 0, transactionCount: 0, categories: {} };
    row.transactionCount++;
    if (tx.amountPaise < 0) {
      const spend = Math.abs(tx.amountPaise);
      row.spendPaise += spend;
      row.categories[tx.category] = (row.categories[tx.category] ?? 0) + spend;
      categoryTotals[tx.category] = (categoryTotals[tx.category] ?? 0) + spend;
      totalSpendPaise += spend;
    } else {
      row.creditsPaise += tx.amountPaise;
      totalCreditsPaise += tx.amountPaise;
    }
    row.netSpendPaise = row.spendPaise - row.creditsPaise;
    months.set(month, row);
  }
  return { totalSpendPaise, totalCreditsPaise, netSpendPaise: totalSpendPaise - totalCreditsPaise, totalRewardPoints, transactionCount: transactions.length, monthly: [...months.values()].sort((a,b)=>a.month.localeCompare(b.month)), categoryTotals };
}
export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}
export function transactionsToCsv(rows: Transaction[]): string {
  const quote = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
  return ["Date,Description,Amount INR,Reward Points,Category", ...rows.map(r => [r.date, r.description, (r.amountPaise/100).toFixed(2), r.rewardPoints, r.category].map(quote).join(","))].join("\r\n");
}
