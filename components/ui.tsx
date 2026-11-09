"use client";
import { Archive, ChevronRight, Shield, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Participant, Role } from "../lib/types";
import { roleNames } from "../lib/types";

export function Empty({ title, detail, children, icon: Icon = Archive }: { title: string; detail: string; children?: ReactNode; icon?: LucideIcon }) {
  return <div className="empty"><span className="empty-icon"><Icon size={25} strokeWidth={1.4}/></span><strong>{title}</strong><p>{detail}</p>{children}</div>;
}

export function Panel({ title, tag, children, className = "" }: { title: string; tag?: string; children: ReactNode; className?: string }) {
  return <section className={"panel " + className}><header className="panel-title"><h2>{title}</h2>{tag && <span className="tag">{tag}</span>}</header>{children}</section>;
}
export function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
export function PersonSelect({ people, value, change, label, placeholder = "Избери участник", disabled }: {
  people: Participant[]; value: string; change: (value: string) => void; label: string; placeholder?: string; disabled?: boolean;
}) {
  return <select aria-label={label} value={value} onChange={e => change(e.target.value)} disabled={disabled}>
    <option value="">{placeholder}</option>{people.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
  </select>;
}
export function RoleSelect({ value, change, label = "Публично разкрита роля" }: { value: Role | ""; change: (v: Role | "") => void; label?: string }) {
  return <select value={value} aria-label={label} onChange={e => change(e.target.value as Role | "")}>
    <option value="">Неизвестна</option>{Object.entries(roleNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </select>;
}
export function PickPeople({ people, values, change }: { people: Participant[]; values: string[]; change: (v: string[]) => void }) {
  return <div className="pick-people">{people.map(p => <label key={p.id}><input type="checkbox" checked={values.includes(p.id)}
    onChange={e => change(e.target.checked ? [...values,p.id] : values.filter(id => id !== p.id))}/>{p.name}</label>)}</div>;
}
export function Avatar({ person }: { person: Participant }) {
  return <span className="avatar" aria-hidden="true">{person.name.split(/\s+/).slice(0,2).map(s => s[0]).join("")}
    {person.photo && <img src={person.photo} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.hidden = true; }}/>}</span>;
}
export function Score({ value, signed = true }: { value: number; signed?: boolean }) {
  return <span className={value > 0 ? "score danger" : value < 0 ? "score good" : "score muted"}>{signed && value > 0 ? "+" : ""}{value.toLocaleString("bg-BG", { maximumFractionDigits: 6 })}</span>;
}
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="link-button" onClick={onClick}>{children}<ChevronRight size={15}/></button>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-icon"><Shield size={21} strokeWidth={1.6}/></span>
    <div><b>THE TRAITORS</b><small>{compact ? "ANALYTICS" : "A N A L Y T I C S"}</small></div></div>;
}
export type SaveSeason = (season: import("../lib/types").Season) => Promise<boolean>;
