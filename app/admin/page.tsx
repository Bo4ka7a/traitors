import type { Metadata } from "next";
import { Workspace } from "../../components/workspace";

export const metadata: Metadata = { title: "Администрация · The Traitors Analytics", robots: { index: false, follow: false } };
export default function AdminPage() { return <Workspace />; }
