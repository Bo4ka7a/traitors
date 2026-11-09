import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, deleteDoc, doc, getDocFromServer, getFirestore, onSnapshot, runTransaction } from "firebase/firestore";
import { makePublication, publicationSchema } from "./publication";
import { validateSeason } from "./validation";
import type { Season } from "./types";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(Boolean);
export const localDevelopment = process.env.NODE_ENV === "development" && !Object.values(config).some(Boolean);
function services() {
  const app = getApps()[0] ?? initializeApp(config);
  return { auth: getAuth(app), db: getFirestore(app) };
}
export function authObserver(callback: (u: User | null) => void, error: (e: Error) => void) {
  return onAuthStateChanged(services().auth, callback, error);
}
export function login() {
  return signInWithPopup(services().auth, new GoogleAuthProvider());
}
export function logout() {
  return signOut(services().auth);
}
export async function authorized(uid: string) {
  const { db } = services();
  return (await getDocFromServer(doc(db, "admins", uid))).exists();
}
export function watch(uid: string, receive: (seasons: Season[], cached: boolean) => void, fail: (err: Error) => void) {
  const { db } = services();
  return onSnapshot(collection(db, "users", uid, "seasons"), { includeMetadataChanges: true }, snapshot => {
    try {
      receive(snapshot.docs.map(d => validateSeason(JSON.parse(d.data().payload))), snapshot.metadata.fromCache);
    } catch (e) { fail(e as Error); }
  }, fail);
}
const key = "traitors-analytics.v1";
export function readLocal(): Season[] {
  const saved = localStorage.getItem(key);
  return saved ? (JSON.parse(saved) as unknown[]).map(validateSeason) : [];
}
export function observeLocal(receive: (seasons: Season[]) => void, fail: (error: Error) => void) {
  function onStorage(e: StorageEvent) {
    if (e.key !== key) return;
    try { receive(readLocal()); } catch (err) { fail(err as Error); }
  }
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
export type Change = { before?: Season; after?: Season };
function check(change: Change, current?: Season) {
  if (JSON.stringify(change.before) !== JSON.stringify(current)) {
    throw new Error("Данните са променени на друго устройство. Прегледайте актуалната версия и повторете редакцията.");
  }
}
export async function commit(uid: string | null, changes: Change[]) {
  const ids = changes.map(({ before, after }) => (before ?? after)!.id);
  const values = changes.map(({ after }) => after ? validateSeason(after) : undefined);
  if (!uid) {
    const write = () => {
      const seasons = new Map(readLocal().map(s => [s.id, s]));
      changes.forEach((c, i) => check(c, seasons.get(ids[i])));
      values.forEach((value, i) => value ? seasons.set(ids[i], value) : seasons.delete(ids[i]));
      localStorage.setItem(key, JSON.stringify([...seasons.values()]));
    };
    if (navigator.locks) await navigator.locks.request(key, write);
    else write();
    return;
  }
  const bytes = changes.reduce((size, change, i) => size + new TextEncoder().encode(JSON.stringify([change.before, values[i]])).length, 0);
  if (bytes > 8_000_000 || changes.length > 100) throw new Error("Операцията надхвърля лимита за една Firebase транзакция.");
  const { db } = services();
  await runTransaction(db, async tx => {
    const refs = ids.map(id => doc(db, "users", uid, "seasons", id));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    snapshots.forEach((s, i) => check(changes[i], s.exists() ? validateSeason(JSON.parse(s.data().payload)) : undefined));
    values.forEach((value, i) => {
      if (value) tx.set(refs[i], { id: ids[i], payload: JSON.stringify(value) });
      else tx.delete(refs[i]);
    });
  });
}

export async function readPublication() {
  const snapshot = await getDocFromServer(doc(services().db, "publication", "current"));
  return snapshot.exists() ? publicationSchema.parse(JSON.parse(snapshot.data().payload)) : null;
}

export async function publishSeason(uid: string, seasonId: string, through: number) {
  const { db } = services();
  return runTransaction(db, async tx => {
    const season = await tx.get(doc(db, "users", uid, "seasons", seasonId));
    if (!season.exists()) throw new Error("Сезонът не е намерен.");
    const publication = makePublication(validateSeason(JSON.parse(season.data().payload)), through);
    tx.set(doc(db, "publication", "current"), { payload: JSON.stringify(publication) });
    return publication;
  });
}

export function unpublishSeason() {
  return deleteDoc(doc(services().db, "publication", "current"));
}