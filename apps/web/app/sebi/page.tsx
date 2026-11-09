import type { Metadata } from "next";
import SebiDashboard from "../../components/sebi/sebi-dashboard";
import { sebiPrisma } from "../../lib/sebi/prisma";
import "./sebi.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEBI Intelligence | Corleon Engine",
  description: "Source-grounded SEBI regulatory intelligence, circular discovery and investor-protection research.",
};

type InitialDocument = {
  id: string;
  title: string;
  canonicalUrl: string;
  description: string | null;
  category: string;
  publishedAt: string | null;
  fetchedAt: string;
  status: string;
};

export default async function SebiPage() {
  let initialDocuments: InitialDocument[] = [];
  let initialTotal = 0;
  try {
    const [documents, total] = await Promise.all([
      sebiPrisma.sebiDocument.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
        take: 30,
        select: { id: true, title: true, canonicalUrl: true, description: true, category: true, publishedAt: true, fetchedAt: true, status: true },
      }),
      sebiPrisma.sebiDocument.count({ where: { status: { not: "ARCHIVED" } } }),
    ]);
    initialDocuments = documents.map((doc) => ({
      ...doc,
      publishedAt: doc.publishedAt?.toISOString() ?? null,
      fetchedAt: doc.fetchedAt.toISOString(),
    }));
    initialTotal = total;
  } catch (error) {
    console.error("SEBI initial source query unavailable", error);
  }
  return <SebiDashboard initialDocuments={initialDocuments} initialTotal={initialTotal} />;
}
