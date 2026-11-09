import type { Metadata } from "next";
import SebiDashboard from "../../components/sebi/sebi-dashboard";
import "./sebi.css";

export const metadata: Metadata = {
  title: "SEBI Intelligence | Corleon Engine",
  description: "Source-grounded SEBI regulatory intelligence, circular discovery and investor-protection research.",
};

export default function SebiPage() {
  return <SebiDashboard />;
}
