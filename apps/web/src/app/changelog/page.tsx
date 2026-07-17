import type { Metadata } from "next";
import ChangelogClient from "./ChangelogClient";

export const metadata: Metadata = {
  title: "Changelog",
  description: "QS Assets product changelog — releases for discovery, ITSM, security, and platform operations.",
  openGraph: {
    title: "Changelog | QS Assets",
    description: "What shipped recently in QS Assets.",
  },
  alternates: { canonical: "https://www.qsasset.com/changelog" },
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
