"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { episodesThrough } from "../lib/model";
import type { Publication } from "../lib/publication";
import { publishSeason, readPublication, unpublishSeason } from "../lib/storage";
import type { Season } from "../lib/types";
import { Field, Heading, Panel } from "./ui";

export function PublicationSettings({ season, uid }: { season: Season; uid?: string }) {
  const episodes = episodesThrough(season).reverse();
  const [selected, setSelected] = useState(0);
  const through = episodes.find(e => e.number === selected)?.number ?? episodes[0]?.number;
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(!!uid);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!uid) return;
    let active = true;
    readPublication().then(result => {
      if (active) setPublication(result);
    }).catch(err => {
      if (active) setError(err.code === "permission-denied" ? "Публикувайте обновените правила на Firestore, за да активирате публичния архив." : "Публичният архив е временно недостъпен.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [uid]);

  async function change(action: () => Promise<Publication | null>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { setPublication(await action()); setMessage(success); }
    catch (err) { setError((err as { code?: string }).code === "permission-denied" ? "Публикувайте обновените правила на Firestore, за да активирате публичния архив." : (err as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading title="Публикуване" description="Изберете кои записани епизоди да се виждат от посетителите." action={<Link className="action-link" href="/"><Globe size={16}/> Публична страница</Link>}/>
    <Panel title="Публичен архив" tag={publication ? "Публикуван" : undefined}>
      <p className="muted">Публикуването обновява публичната страница с избрания сезон, номерата и датите на епизодите, имената и статусите на участниците и класацията. Частният архив и тайните роли остават в администрацията.</p>
      {!uid ? <p className="muted">Публикуването е достъпно в облачния архив след вход.</p> : <>
        {loading ? <p role="status">Зареждане…</p> :
          <p>{publication ? `${publication.title} · публикуван до епизод ${publication.through}` : "Няма публикуван сезон."}</p>}
        {episodes.length > 0 && <Field label="Публикувай до епизод"><select value={through} disabled={busy} onChange={e => setSelected(Number(e.target.value))}>
          {episodes.map(e => <option value={e.number} key={e.id}>Епизод {e.number}</option>)}
        </select></Field>}
        <div className="toolbar">
          <button className="primary" disabled={!through || loading || busy} onClick={() => {
            if (through) void change(() => publishSeason(uid, season.id, through), "Публичният архив е обновен.");
          }}><Globe size={16}/> Публикувай избрания сезон</button>
          {publication && <button disabled={busy} onClick={() => void change(async () => {
            await unpublishSeason();
            return null;
          }, "Публикацията е свалена.")}>Свали публикацията</button>}
        </div>
      </>}
      {error && <p className="danger" role="alert">{error}</p>}
      {message && <p className="good" role="status">{message}</p>}
    </Panel>
  </>;
}
