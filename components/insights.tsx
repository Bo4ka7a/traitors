"use client";
import { useState } from "react";
import { Activity, CalendarDays, ChartNoAxesCombined, Crosshair, FlaskConical, Gavel, Layers3, Plus, Shield, Skull, Users } from "lucide-react";
import { combinations, evaluate } from "../lib/analysis";
import { decidingRound, episodesThrough, forecast, forecasts, publicFacts, publicInput, tallies } from "../lib/model";
import { baseline, rules } from "../lib/rules";
import { roleNames, statusNames, type Season } from "../lib/types";
import { ScoreChart } from "./charts";
import { Avatar, Empty, Field, Heading, LinkButton, Panel, Score } from "./ui";

export type Ranking = ReturnType<typeof forecast>;
type History = ReturnType<typeof forecasts>;

export function Dashboard({ season, history, add, rankingPage, votesPage, open }: {
  season: Season; history: History; add: () => void; rankingPage: () => void; votesPage: () => void; open: (id: string) => void;
}) {
  const episode = episodesThrough(season).at(-1);
  const ranking = history.at(-1)?.ranking ?? forecast(publicInput(season),1);
  const previous = history.at(-2)?.ranking ?? [];
  const active = ranking.filter(p => p.status === "active");
  const leaders = active.some(p => p.evidence.length) ? active.slice(0,5) : [];
  const changes = active.map(p => ({ ...p, delta: p.score - (previous.find(old => old.id === p.id)?.score ?? 0) }))
    .filter(p => Math.abs(p.delta) > 0.000001).sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5);
  const lastTable = episodesThrough(season).flatMap(e => e.tables.map(table => ({ table, ep: e.number }))).at(-1);
  const lastRound = lastTable && (decidingRound(lastTable.table) ?? lastTable.table.rounds.at(-1));
  const lastVotes = lastRound && Object.entries(tallies(lastRound)).sort((a,b) => b[1]-a[1]).slice(0,5);
  const metrics = [
    { label: "Последен епизод", value: episode ? "Еп. " + episode.number : "—", note: episode?.date || (episode ? "Дата не е въведена" : "Очаква запис"), icon: CalendarDays, tone: "gold" },
    { label: "Активни участници", value: active.length, note: "Все още в играта", icon: Users, tone: "green" },
    { label: "Прогонени", value: ranking.filter(p => p.status === "banished").length, note: "От кръглата маса", icon: Gavel, tone: "red" },
    { label: "Убити", value: ranking.filter(p => p.status === "murdered").length, note: "От предателите", icon: Skull, tone: "violet" },
  ];
  return <>
    <section className="hero">
      <div className="hero-graphic" aria-hidden="true">
        <svg viewBox="0 0 350 255" fill="none">
          <g stroke="currentColor" opacity=".5"><circle cx="205" cy="128" r="106"/><circle cx="205" cy="128" r="94" strokeDasharray="2 7"/>
            <circle cx="205" cy="128" r="68"/><circle cx="205" cy="128" r="42"/><path d="M205 8v240M81 128h248M122 45l166 166m0-166L122 211"/>
            <path d="m205 23 105 105-105 105L100 128 205 23Z"/><path d="m205 57 71 71-71 71-71-71 71-71Z"/></g>
          <g stroke="currentColor" strokeWidth="1.4"><path d="M205 80c11 12 26 14 39 16v32c0 24-17 39-39 49-22-10-39-25-39-49V96c13-2 28-4 39-16Z" fill="var(--hero-shield)"/>
            <path d="M183 127c12-14 32-14 44 0-12 14-32 14-44 0Z"/><circle cx="205" cy="127" r="6"/>
            <path d="m205 87 0 14m0 52v14M106 31h10m-5-5v10m193 182h10m-5-5v10M68 157h10m-5-5v10"/></g>
        </svg>
      </div>
      <div className="hero-content"><div className="eyebrow"><span/> БЪЛГАРСКИ СЕЗОН</div>
        <h1>Анализ на сезона</h1><p>Проследявайте епизодите, сравнявайте гласовете и вижте как се променят подозренията.</p>
        <button className="primary" onClick={add}><Plus size={18}/> Добави епизод</button>
      </div>
    </section>
    <div className="metrics">{metrics.map(m => <div className="metric" key={m.label}>
      <span className={"metric-icon " + m.tone}><m.icon size={19} strokeWidth={1.7}/></span><div className="metric-label">{m.label}</div>
      <strong>{m.value}</strong><small>{m.note}</small>
    </div>)}</div>
    <div className="dashboard-grid">
      <Panel title="Динамика на подозрителността" tag="По епизоди">
        {history.length && leaders.length && history.some(h => h.ranking.some(p => p.evidence.length)) ?
          <ScoreChart history={history} people={leaders}/> :
          <Empty icon={ChartNoAxesCombined} title="Очакват се първите резултати" detail="Графиката ще се попълни, когато въведените събития активират правило."/>}
      </Panel>
      <Panel title="Най-подозрителни" tag="Топ 5">
        {leaders.length ? <div className="rank-list">{leaders.map(p => <button key={p.id} onClick={() => open(p.id)} className="rank-card">
          <span className="muted">{leaders.findIndex(row => row.score === p.score)+1}</span><Avatar person={p}/><strong>{p.name}</strong><Score value={p.score}/></button>)}</div> :
          <Empty icon={Crosshair} title="Класацията е празна" detail="Добавете участници и запишете гласуване."/>}
        <LinkButton onClick={rankingPage}>Отвори класацията</LinkButton>
      </Panel>
      <Panel title="Последно гласуване" tag={lastTable ? "Еп. " + lastTable.ep : undefined}>
        {lastVotes?.length ? <div className="stack">
          <span className="muted">{lastTable?.table.decision ? "Потвърдено прогонване" : "Без потвърдено прогонване"}</span>
          {lastVotes.map(([id,n]) => <div className="split" key={id}><span>{season.participants.find(p => p.id === id)?.name ?? id}</span><b>{n}</b></div>)}
        </div> : <Empty icon={Gavel} title="Липсват записани гласове" detail="Разпределението се показва след въвеждането на гласове."/>}
        <LinkButton onClick={votesPage}>Отвори кръглата маса</LinkButton>
      </Panel>
      <Panel title="Последни промени">
        {changes.length ? changes.map(p => <div className="split record" key={p.id}><button className="person" onClick={() => open(p.id)}><Avatar person={p}/>{p.name}</button><Score value={p.delta}/></div>) :
          <Empty icon={Activity} title="Няма промени в точките" detail="Тук ще се виждат разликите спрямо предходния епизод."/>}
      </Panel>
    </div>
  </>;
}

export function Rankings({ season, number, history, open }: { season: Season; number: number; history: History; open: (id: string) => void }) {
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("score");
  const [query,setQuery] = useState("");
  const data = history.find(h => h.number === number)?.ranking ?? forecast(publicInput(season),number || 1);
  const old = history.filter(h => h.number < number).at(-1)?.ranking ?? [];
  const filtered = data.filter(p => filter === "all" || filter === p.status);
  const sorted = filtered.map(p => ({ ...p, position: filtered.findIndex(row => row.score === p.score)+1, delta: p.score-(old.find(x => x.id === p.id)?.score ?? 0) }))
    .filter(p => p.name.toLocaleLowerCase("bg").includes(query.toLocaleLowerCase("bg")))
    .sort((a,b) => sort === "delta" ? b.delta-a.delta : sort === "name" ? a.name.localeCompare(b.name,"bg") : sort === "votes" ? b.votes-a.votes : a.position-b.position);
  return <>
    <Heading title="Класация" description="Точки на подозрителност към избрания епизод. Положителните стойности означават повече подозрение."/>
    <Panel title="Резултати" tag={number ? "Епизод " + number : "Без епизод"}>
      <div className="toolbar"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Търси по име" aria-label="Търси по име"/>
        <Field label="Статус"><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Всички</option>
          {Object.entries(statusNames).map(([key,name]) => <option value={key} key={key}>{name}</option>)}</select></Field>
        <Field label="Сортиране"><select value={sort} onChange={e => setSort(e.target.value)}><option value="score">Точки</option><option value="delta">Промяна</option><option value="name">Име</option><option value="votes">Гласове</option></select></Field>
      </div>
      {!sorted.length ? <Empty icon={Crosshair} title="Няма съвпадения" detail="Добавете участници или променете филтрите."/> : <div className="table-wrap"><table>
        <thead><tr><th>Поз.</th><th>Участник</th><th>Точки</th><th>Промяна</th><th>Правила</th><th>Гласове</th><th>Статус</th></tr></thead>
        <tbody>{sorted.map(p => <tr key={p.id}><td>{p.position}</td><td><button className="person" onClick={() => open(p.id)}><Avatar person={p}/>{p.name}</button></td>
          <td><Score value={p.score}/></td><td><Score value={p.delta}/></td><td>{p.evidence.length}</td><td>{p.votes}</td><td>{statusNames[p.status]}</td></tr>)}</tbody>
      </table></div>}
    </Panel>
    <Panel title="Развитие на резултатите">{history.length && sorted.length ? <ScoreChart history={history.filter(h => h.number <= number)} people={sorted.slice(0,8)}/> :
      <Empty icon={ChartNoAxesCombined} title="Няма данни за графиката" detail="Запишете епизод, за да започнете хронологията."/>}
      {sorted.length > 8 && <p className="muted">Показани са първите 8 от текущия изглед.</p>}
    </Panel>
  </>;
}

export function PlayerDetail({ season, id, number, history, close }: { season: Season; id: string; number: number; history: History; close: () => void }) {
  const person = season.participants.find(p => p.id === id);
  if (!person) return null;
  const p = forecast(publicInput(season), number).find(x => x.id === id);
  const role = publicFacts(season,number).filter(x => x.player === id).sort((a,b) => b.from-a.from || b.observed-a.observed)[0]?.role;
  const guess = p?.score ? (p.score > 0 ? "По-скоро предател" : "По-скоро праведен") : "Неопределена";
  const name = (id: string) => season.participants.find(p => p.id === id)?.name ?? id;
  const votes = episodesThrough(season,number).flatMap(e => e.tables.flatMap((t,i) => t.rounds.flatMap((r,j) => {
    const v = r.votes[id];
    return v ? [{ key: r.id, ep: e.number, table: i+1, round: j+1, value: v.target ? name(v.target) : "Не е гласувал(а)", complete: r.complete }] : [];
  })));
  return <dialog open className="detail-dialog" aria-label={"Досие на " + person.name} onKeyDown={e => { if (e.key === "Escape") close(); }}>
    <div className="split"><div className="person"><Avatar person={person}/><h2>{person.name}</h2></div><button autoFocus onClick={close}>Затвори</button></div>
    <div className="stack"><p>Публична роля · {role ? roleNames[role] : "Неизвестна"}</p><p>Предполагаема роля · {guess}</p>
      <p>Общ резултат · <Score value={p?.score ?? 0}/></p></div>
    <h3>Основания за точките</h3>
    {p?.evidence.length ? <div className="stack">{[...p.evidence].sort((a,b) => a.appliedEpisode-b.appliedEpisode).map((v,i) => <div className="split record" key={i}>
      <div><b>{rules.find(r => r.id === v.rule)?.name}</b><p className="muted">{v.detail} · събитие еп. {v.eventEpisode} · начислено в еп. {v.appliedEpisode}</p></div><Score value={v.points}/>
    </div>)}</div> : <p className="muted">Няма начислени точки.</p>}
    {!!history.length && <ScoreChart history={history.filter(h => h.number <= number)} people={[person]}/>}
    <h3>История на гласуванията</h3>
    {votes.length ? votes.map(v => <div className="split record" key={v.key}><span>Еп. {v.ep} · маса {v.table} · тур {v.round}{v.complete ? "" : " · чернова"}</span><b>{v.value}</b></div>) : <p className="muted">Няма въведени гласове.</p>}
  </dialog>;
}

export function Combinations({ season, number }: { season: Season; number: number }) {
  const base = combinations(publicInput(season), number);
  const scenario = season.hypothesis.enabled ? combinations(publicInput(season), number, season.hypothesis) : undefined;
  const name = (id: string) => season.participants.find(p => p.id === id)?.name ?? id;
  const fmt = (n: bigint) => n.toLocaleString("bg-BG");
  function results(result: typeof base) {
    return <><div className="metrics three">
      <div className="metric"><small>Общо</small><strong>{fmt(result.total)}</strong></div>
      <div className="metric"><small>Оставащи</small><strong>{fmt(result.remaining)}</strong></div>
      <div className="metric"><small>Изключени</small><strong>{fmt(result.excluded)}</strong></div>
    </div>
    <div className="stack"><p className="muted">Задължителни в началото: {result.required.map(name).join(", ") || "—"}</p>
      <p className="muted">Изключени от началния състав: {result.ruledOut.map(name).join(", ") || "—"}</p>
      <p className="muted">Публично вербувани до епизода: {result.recruited.map(name).join(", ") || "—"}</p>
      <p className="muted">Отпадат по условия за началния състав: {fmt(result.fixedExcluded)} · по хипотеза за закуската: {fmt(result.breakfastExcluded)}</p>
      {result.conflicts.map((reason,i) => <p className="danger" key={i}>{reason}</p>)}</div>
    {result.examples.length ? <div className="table-wrap"><table><thead><tr><th>Възможен начален състав (до 12)</th><th>Активни предатели в епизода</th></tr></thead>
      <tbody>{result.examples.map((r,i) => <tr key={i}><td>{r.initial.map(name).join(", ") || "—"}</td><td>{r.active.map(name).join(", ") || "—"}</td></tr>)}</tbody></table></div> :
      <Empty icon={Layers3} title="Няма допустими комбинации" detail="Проверете броя на началните предатели, състава и публичните роли."/>}</>;
  }
  return <><Heading title="Комбинации" description="Допустими начални състави според публичните факти, с актуален състав след вербувания и отпадания."/>
    <Panel title="Публични ограничения" tag={season.initialTraitors + " начални предатели"}>{results(base)}</Panel>
    <Panel title="Експериментален сценарий" tag={scenario ? "Включен" : "Изключен"}>
      {scenario ? results(scenario) : <Empty icon={FlaskConical} title="Няма активна хипотеза" detail="Настройте отделен сценарий в „Настройки“."/>}
    </Panel></>;
}
export function Evaluation({ season }: { season: Season }) {
  const [show,setShow] = useState(false);
  const input = publicInput(season);
  const current = evaluate(season,input);
  const original = evaluate(season,{ ...input, model: baseline() });
  const pct = (n: number, d: number) => d ? (n*100/d).toLocaleString("bg-BG",{ maximumFractionDigits: 1 }) + "%" : "—";
  return <><Heading title="Проверка на теорията" description="Сравнете прогнозите в края на всеки епизод с действителните роли за същия момент."
    action={<button onClick={() => setShow(!show)}><Shield size={17}/>{show ? "Скрий оценката" : "Покажи оценката с тайни роли"}</button>}/>
    {!show ? <Panel title="Оценка на модела"><Empty icon={FlaskConical} title="Резултатите са скрити" detail="Оценката използва въведените действителни роли и може да разкрие информация за бъдещи епизоди."/></Panel> : <>
      <Panel title="Прогнози по епизоди">
        <p className="muted">Топ 1/3/5 сред активните в края на епизода. При неизвестна роля, равенство на границата или липса на сигнал показваме тире.</p>
        <p>Предател на първо място · текущ модел {current.first}/{current.eligibleFirst} · базов модел {original.first}/{original.eligibleFirst}</p>
        <div className="table-wrap"><table><thead><tr><th>Епизод</th><th>Базов топ 1</th><th>Базов топ 3</th><th>Базов топ 5</th><th>Текущ топ 1</th><th>Текущ топ 3</th><th>Текущ топ 5</th></tr></thead>
          <tbody>{current.rows.map((r,i) => <tr key={r.number}><td>{r.number}</td>{[original.rows[i],r].flatMap(row => [row.top1,row.top3,row.top5]).map((v,j) => <td key={j}>{v ?? "—"}</td>)}</tr>)}</tbody></table></div>
      </Panel>
      <div className="two">
        <Panel title="Ретроспективна проверка" tag="Всички записани събития">
          <div className="stack">
            <div className="split"><span>Burn votes от предатели ({current.burnTraitor}/{current.burnKnown} с известна роля)</span><b>{pct(current.burnTraitor,current.burnKnown)}</b></div>
            <div className="split"><span>Праведни с поне един burn vote ({current.faithfulBurn}/{current.faithfulEligible} гласували при допустими условия)</span><b>{pct(current.faithfulBurn,current.faithfulEligible)}</b></div>
            <div className="split"><span>Последни групи с поне един предател и известни роли ({current.breakfastWithTraitor}/{current.breakfastTotal})</span><b>{pct(current.breakfastWithTraitor,current.breakfastTotal)}</b></div>
          </div>
        </Panel>
        <Panel title="Начислявания по правила" tag="Базов / текущ">
          {rules.map(r => <div className="split record" key={r.id}><span>{r.name}</span><b>{original.occurrences[r.id] ?? 0} / {current.occurrences[r.id] ?? 0}</b></div>)}
        </Panel>
      </div>
    </>}</>;
}

