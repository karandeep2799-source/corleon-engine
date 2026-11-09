import type { Metadata } from "next";
import BitcoinWorkspace from "../../components/bitcoin/bitcoin-workspace";
import "./bitcoin.css";

export const metadata: Metadata = {
  title: "Bitcoin Knowledge | Corleon Engine",
  description: "Bitcoin technical Q&A and source-grounded AI research, powered by community knowledge."
};

export default function BitcoinPage() {
  return <BitcoinWorkspace />;
}
