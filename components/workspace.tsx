"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarDays, ChevronDown, Cloud, CloudOff, Coffee, Database, FlaskConical, Gavel, Globe, LayoutDashboard, Layers3, LockKeyhole, LogOut, Menu, Settings2, Shield, Users, X } from "lucide-react";
import { episodesThrough, forecasts, publicInput } from "../lib/model";
import { baseline } from "../lib/rules";
import { login, logout } from "../lib/storage";
import type { Episode, Season } from "../lib/types";
import { Breakfasts, Voting } from "./events";
import { Combinations, Dashboard, Evaluation, PlayerDetail, Rankings } from "./insights";
import { EpisodePicker, Episodes, Participants } from "./records";
import { useSession } from "./session";
import { PublicationSettings } from "./publication-settings";
import { Settings } from "./settings";
import { Brand, Empty } from "./ui";

const nav = [
  { key: "dashboard", label: "Начало", icon: LayoutDashboard },
  { key: "participants", label: "Участници", icon: Users },
  { key: "episodes", label: "Епизоди", icon: CalendarDays },
  { key: "votes", label: "Кръгла маса", icon: Gavel },
  { key: "breakfast", label: "Закуска", icon: Coffee },
  { key: "ranking", label: "Класация", icon: Activity },
  { key: "combos", label: "Комбинации", icon: Layers3 },
  { key: "evaluation", label: "Проверка на теорията", icon: FlaskConical },
  { key: "publication", label: "Публикуване", icon: Globe },
  { key: "settings", label: "Настройки", icon: Settings2 },
] as const;
type Page = typeof nav[number]["key"];
const initial: Season = { id: "bulgaria-1", title: "България · Сезон 1", initialTraitors: 3, model: baseline(), participants: [], episodes: [],
  privateRoles: [], hypothesis: { enabled: false, required: [], excluded: [], breakfastLimit: false } };

export function Workspace() {
  const session = useSession();
  const [page, setPage] = useState<Page>("dashboard");
  const [seasonId, setSeasonId] = useState("");
  const [selected, setSelected] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [light, setLight] = useState(false);
  const [newEpisode, setNewEpisode] = useState(0);
  const seasons = useMemo(() => [...session.seasons].sort((a,b) => a.title.localeCompare(b.title,"bg") || a.id.localeCompare(b.id)), [session.seasons]);
  const season = seasons.find(s => s.id === seasonId) ?? seasons[0] ?? initial;
  const episode = season.episodes.find(e => e.number === selected) ?? episodesThrough(season).at(-1);
  const number = episode?.number ?? 0;
  const history = useMemo(() => forecasts(publicInput(season)), [season]);

  useEffect(() => {
    setLight(localStorage.getItem("traitors-theme") === "light");
    const syncHash = () => {
      const key = window.location.hash.slice(1);
      setPage(nav.find(n => n.key === key)?.key ?? "dashboard");
      setDetail(null);
    };
    syncHash();
    window.addEventListener("hashchange",syncHash);
    return () => window.removeEventListener("hashchange",syncHash);
  }, []);

  function go(next: Page) {
    setPage(next); setDetail(null); setMenu(false);
    if (window.location.hash !== "#" + next) window.location.hash = next;
    window.scrollTo(0,0);
  }
  function addEpisode() {
    setNewEpisode(i => i+1);
    go("episodes");
  }
  function selectSeason(id: string) {
    setSeasonId(id); setSelected(0); setDetail(null);
  }
  function save(after: Season) {
    return session.save([{ before: seasons.find(s => s.id === after.id), after }]);
  }
  function edit(ep: Episode) {
    const episodes = season.episodes.some(e => e.id === ep.id) ? season.episodes.map(e => e.id === ep.id ? ep : e) : [...season.episodes,ep];
    return save({ ...season, episodes });
  }
  function toggleTheme() {
    setLight(!light); localStorage.setItem("traitors-theme", light ? "dark" : "light");
  }
  const current = nav.find(n => n.key === page)!;
  const local = session.mode === "local";
  const ready = local || session.mode === "cloud";
  const eventProps = { season, episode, edit, setNumber: setSelected, addEpisode };

  if (!ready) {
    const blocked = session.mode === "denied";
    const title = session.mode === "loading" ? "Зареждане на архива…" : blocked ? "Изисква се администраторски достъп" :
      session.mode === "configuration" ? "Необходима е Firebase конфигурация" : session.mode === "failed" ? "Хранилището е недостъпно" : "Вход в архива";
    const description = blocked ? "Добавете Firebase UID в администраторския списък. След това влезте отново." :
      session.mode === "configuration" ? "Попълнете четирите Firebase променливи за средата на проекта." : session.mode === "loading" ?
        "Проверяваме достъпа до работното пространство." : session.mode === "failed" ? "Презаредете страницата, за да опитате отново." : "Използвайте разрешения си Google профил.";
    return <div className="login" data-theme={light ? "light" : "dark"}><Brand/><div className="panel">
      <Empty title={title} detail={description} icon={LockKeyhole}>
        {blocked && <code>{session.user?.uid}</code>}
        {session.mode === "signed-out" && <button className="primary" onClick={() => login().catch(e => session.setError(e.message))}>Вход с Google <ArrowRight size={17}/></button>}
        {session.user && <button onClick={() => logout().catch(e => session.setError(e.message))}>Изход</button>}
        {session.error && <p className="danger" role="alert">{session.error}</p>}
      </Empty></div><Link className="action-link" href="/">Публична страница</Link></div>;
  }

  return <div className="shell" data-theme={light ? "light" : "dark"}>
    {menu && <button className="overlay" aria-label="Затвори менюто" onClick={() => setMenu(false)}/>}
    <aside className={"sidebar" + (menu ? " expanded" : "")}>
      <Brand/><button className="mobile-close icon-button" aria-label="Затвори менюто" onClick={() => setMenu(false)}><X size={19}/></button>
      <div className="nav-caption">РАБОТНО ПРОСТРАНСТВО</div>
      <nav aria-label="Основна навигация">{nav.map((item,i) => <div key={item.key} className={i === 5 || i === 8 ? "nav-divider" : ""}>
        <a href={"#" + item.key} aria-current={page === item.key ? "page" : undefined} className={page === item.key ? "current" : ""}
          onClick={e => { e.preventDefault(); go(item.key); }}><item.icon size={18} strokeWidth={1.65}/><span>{item.label}</span></a></div>)}</nav>
      <div className="sidebar-foot"><span className="foot-icon"><Shield size={18}/></span>
        <div><b>{local ? "Локален архив" : "Администратор"}</b><small>{local ? "Този браузър" : session.user?.email}</small></div>
        {!local && <button aria-label="Изход" className="icon-button" onClick={() => logout().catch(e => session.setError(e.message))}><LogOut size={16}/></button>}
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label="Отвори менюто" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={23}/></button>
        <div className="breadcrumb"><span>Анализи</span><span>/</span><b>{current.label}</b></div>
        <div className="topbar-actions">
          <Link className="public-shortcut icon-button" href="/" aria-label="Публична страница" title="Публична страница"><Globe size={17}/></Link>
          <span className="sync" role="status">{local ? <Database size={15}/> : session.cached ? <CloudOff size={15}/> : <Cloud size={15}/>}
            <span>{session.saving ? "Запазване…" : session.cached ? "Офлайн · кеш" : local ? "Локален режим" : "Синхронизирано"}</span></span>
          <div className="season-picker"><select aria-label="Избран сезон" value={season.id} onChange={e => selectSeason(e.target.value)}>
            {(seasons.length ? seasons : [initial]).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select><ChevronDown size={14}/></div>
        </div>
      </header>
      <main>
        {session.error && <div className="alert" role="alert"><span>{session.error}</span><button className="icon-button" aria-label="Затвори съобщението" onClick={() => session.setError("")}><X size={17}/></button></div>}
        {local && <div className="local-notice"><CloudOff size={16}/><span>Данните се пазят в този браузър. Настройте Firebase за вход и синхронизация между устройства.</span></div>}
        {session.cached && <div className="local-notice"><CloudOff size={16}/>Показва се кешираният архив. Записването изисква връзка с Firebase.</div>}
        {["ranking","combos","participants"].includes(page) && !!number && <div className="toolbar contextual"><span className="muted">Изглед към</span><EpisodePicker season={season} number={number} change={setSelected}/></div>}
        <fieldset className="content" disabled={session.saving || session.cached} key={season.id + "/" + page}>
          {page === "dashboard" && <Dashboard season={season} history={history} add={addEpisode} rankingPage={() => go("ranking")} votesPage={() => go("votes")}
            open={id => { setSelected(0); setDetail(id); }}/>}
          {page === "participants" && <Participants season={season} save={save} number={number || 1} open={setDetail}/>}
          {page === "episodes" && <Episodes key={newEpisode} season={season} episode={episode} setNumber={setSelected} edit={edit} go={go} forceAdd={newEpisode > 0}
            clearForce={() => setNewEpisode(0)}/>}
          {page === "votes" && <Voting {...eventProps}/>}
          {page === "breakfast" && <Breakfasts {...eventProps}/>}
          {page === "ranking" && <Rankings season={season} history={history} number={number} open={setDetail}/>}
          {page === "combos" && <Combinations season={season} number={number || 1}/>}
          {page === "evaluation" && <Evaluation season={season}/>}
          {page === "publication" && <PublicationSettings season={season} uid={session.user?.uid}/>}
          {page === "settings" && <Settings season={season} seasons={seasons} save={save} commit={session.save} select={selectSeason} light={light} theme={toggleTheme} fail={session.setError}/>}
        </fieldset>
        {detail && <><button className="dialog-overlay" aria-label="Затвори досието" onClick={() => setDetail(null)}/><PlayerDetail season={season} id={detail} number={number || 1} history={history} close={() => setDetail(null)}/></>}
        <footer><span>THE TRAITORS ANALYTICS</span><span>Независим инструмент за анализ</span></footer>
      </main>
    </div>
  </div>;
}
