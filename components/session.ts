"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { authorized, authObserver, commit, configured, localDevelopment, observeLocal, readLocal, watch, type Change } from "../lib/storage";
import type { Season } from "../lib/types";
import { validateSeason } from "../lib/validation";

type Session = "loading" | "local" | "configuration" | "signed-out" | "denied" | "cloud" | "failed";
export function useSession() {
  const [mode, setMode] = useState<Session>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [cached, setCached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    let stopped = false, generation = 0;
    let unsubscribe: (() => void) | undefined;
    function fail(err: Error) { setError(err.message); setMode("failed"); }
    if (!configured && !localDevelopment) { setMode("configuration"); return; }
    if (localDevelopment) {
      try { setSeasons(readLocal()); setMode("local"); } catch (e) { fail(e as Error); }
      return observeLocal(setSeasons, fail);
    }
    const stopAuth = authObserver(async current => {
      const check = ++generation;
      unsubscribe?.();
      setUser(current);
      setSeasons([]);
      setError("");
      if (!current) { setMode("signed-out"); return; }
      setMode("loading");
      try {
        const allow = await authorized(current.uid);
        if (stopped || check !== generation) return;
        if (!allow) { setMode("denied"); return; }
        unsubscribe = watch(current.uid, (rows, offline) => {
          setSeasons(rows); setCached(offline); setMode("cloud");
        }, fail);
      } catch (e) { if (!stopped && check === generation) fail(e as Error); }
    }, fail);
    return () => { stopped = true; stopAuth(); unsubscribe?.(); };
  }, []);

  async function save(changes: Change[]) {
    if (pending.current || !["cloud", "local"].includes(mode)) return false;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await commit(mode === "cloud" ? user!.uid : null, changes);
      if (mode === "local") setSeasons(readLocal());
      else setSeasons(current => {
        const next = new Map(current.map(s => [s.id, s]));
        for (const { before, after } of changes) {
          const id = (before ?? after)!.id;
          if (JSON.stringify(next.get(id)) !== JSON.stringify(before)) continue;
          if (after) next.set(id, validateSeason(after));
          else next.delete(id);
        }
        return [...next.values()];
      });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
      pending.current = false;
    }
  }
  return { mode, user, seasons, cached, saving, error, setError, save };
}
