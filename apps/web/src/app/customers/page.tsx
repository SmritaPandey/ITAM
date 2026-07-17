import type { Metadata } from "next";
import CustomersClient from "./CustomersClient";

export const metadata: Metadata = {
  title: "Customer Stories",
  description:
    "How teams use QS Assets for discovery, ITAM/ITSM, and multi-site asset operations — outcomes from 200+ customer teams.",
  openGraph: {
    title: "Customer Stories | QS Assets",
    description: "Real deployment outcomes for QS Assets customers.",
  },
  alternates: { canonical: "https://www.qsasset.com/customers" },
};

export default function CustomersPage() {
  return <CustomersClient />;
}
