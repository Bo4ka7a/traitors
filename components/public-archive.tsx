"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, LockKeyhole, Users } from "lucide-react";
import type { Publication } from "../lib/publication";
import { configured, readPublication } from "../lib/storage";
import { statusNames } from "../lib/types";
import { Brand, Empty, Panel, Score } from "./ui";

export function PublicArchive() {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(configured);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    readPublication().then(value => {
      if (active) setPublication(value);
    }).catch(error => {
      // Older production rules deny this new document until the administrator publishes the update.
      if (active && error.code !== "permission-denied") setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const ranked = publication?.participants.filter(p => p.status === "active") ?? [];
  return <div className="public-shell shell" data-theme="dark">
    <header className="topbar public-bar"><Brand/><Link className="action-link" href="/admin"><LockKeyhole size={16}/> Администрация</Link></header>
    <main className="content">
      <section className="hero public-hero"><div className="hero-content">
        <div className="eyebrow"><span/> ПУБЛИЧЕН АРХИВ</div>
        <h1>The Traitors Analytics</h1>
        <p>Участници, епизоди и класация по точки на подозрителност.</p>
      </div></section>
      {loading ? <Panel title="Публичен архив"><p role="status" className="muted">Зареждане…</p></Panel> :
        failed ? <Panel title="Публичен архив"><Empty title="Архивът временно е недостъпен" detail="Опитайте да презаредите страницата."/></Panel> :
        !publication ? <Panel title="Публичен архив"><Empty icon={CalendarDays} title="Все още няма публикувани резултати" detail="Тук ще се появят участниците, епизодите и класацията, когато бъдат публикувани."/></Panel> :
        <>
          <div className="page-heading"><div><h2>{publication.title}</h2><p>Публикувано до епизод {publication.through}</p></div></div>
          <div className="two">
            <Panel title="Класация на активните участници" tag={"Еп. " + publication.through}>
              {ranked.length ? <div className="table-wrap"><table><thead><tr><th>Поз.</th><th>Участник</th><th>Точки</th></tr></thead>
                <tbody>{ranked.map((p, i) => <tr key={i}><td>{ranked.findIndex(row => row.score === p.score) + 1}</td><td>{p.name}</td><td><Score value={p.score}/></td></tr>)}</tbody>
              </table></div> : <Empty icon={ChartNoAxesCombined} title="Няма активни участници" detail="Класацията показва участниците, които остават в играта."/>}
            </Panel>
            <Panel title="Публикувани епизоди" tag={String(publication.episodes.length)}>
              <div className="stack">{[...publication.episodes].reverse().map(e => <div className="split record" key={e.number}>
                <b>Епизод {e.number}</b><span className="muted">{e.date || "Без дата"}</span>
              </div>)}</div>
            </Panel>
          </div>
          <Panel title="Участници" tag={String(publication.participants.length)}>
            {publication.participants.length ? <div className="table-wrap"><table><thead><tr><th>Участник</th><th>Статус</th></tr></thead>
              <tbody>{publication.participants.map((p, i) => <tr key={i}><td>{p.name}</td><td>{statusNames[p.status]}</td></tr>)}</tbody>
            </table></div> : <Empty icon={Users} title="Няма публикувани участници" detail="Съставът ще се появи след публикуване на данните за участниците."/>}
          </Panel>
        </>}
      <footer><span>THE TRAITORS ANALYTICS</span><span>Независим инструмент за анализ</span></footer>
    </main>
  </div>;
}
