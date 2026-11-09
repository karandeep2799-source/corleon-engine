import type { Metadata } from "next";
import StocksWorkspace from "@/components/stocks/stocks-workspace";
import "./stocks.css";

export const metadata: Metadata = {
  title: "Stock Intelligence | Corleon Engine",
  description: "A private, read-only Gmail stock records dashboard with human-reviewed portfolio extraction.",
  robots: { index: false, follow: false },
};

export default function StocksPage() {
  return <StocksWorkspace />;
}
