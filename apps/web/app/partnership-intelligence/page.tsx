import type { Metadata } from "next";
import PartnershipDashboard from "./partnership-dashboard";
import "./partnership-intelligence.css";

export const metadata: Metadata = {
  title: "Partnership Intelligence | Corleon Engine",
  description: "A governed workspace for partner discovery, campaign intelligence, and AI-assisted business growth.",
  robots: { index: false, follow: false }
};

export default function PartnershipIntelligencePage() {
  return <PartnershipDashboard />;
}
