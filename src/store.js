import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { N_AREAS, THRESHOLDS_VERSION } from './data';
import { pushRecords } from './firebase';
const Ctx = createContext();
export const useApp = () => useContext(Ctx);

// "Owner" = whose records are on screen right now.
// Guest keeps the ORIGINAL storage keys ('records' and 'lastSync'), so records saved
// before accounts existed stay visible and nothing needs to be migrated.
// An email account will use its own keys: records:<uid> and lastSync:<uid>.
export const GUEST_OWNER = 'guest';

export const storageKeys = owner =>
  owner === GUEST_OWNER
    ? { records: 'records', lastSync: 'lastSync' }
    : { records: `records:${owner}`, lastSync: `lastSync:${owner}` };

export function AppProvider({ children }) {
  const [owner, setOwner] = useState(GUEST_OWNER);
  const ownerRef = useRef(GUEST_OWNER); // always the CURRENT owner, even inside slow async work
  const [device, setDevice] = useState(null);
  const [areas, setAreas] = useState(Array(N_AREAS).fill(null));
  const [session, setSession] = useState({ name: '', location: '' });
  const [pref, setPref] = useState('Rice');
  const [records, setRecords] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  // Load this owner's records. If the owner changes before a slow read finishes,
  // the old result is ignored so one owner's records never appear under another.
  useEffect(() => {
    let cancelled = false;
    const keys = storageKeys(owner);
    AsyncStorage.getItem(keys.records).then(v => { if (!cancelled && v) setRecords(JSON.parse(v)); });
    AsyncStorage.getItem(keys.lastSync).then(v => { if (!cancelled && v) setLastSync(v); });
    return () => { cancelled = true; };
  }, [owner]);

  // Switching owner clears only what is held in memory (records on screen, sync time,
  // temporary readings, session text, preferred crop). Stored records are never deleted.
  const switchOwner = nextOwner => {
    ownerRef.current = nextOwner;
    setRecords([]);
    setLastSync(null);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
    setPref('Rice');
    setOwner(nextOwner);
  };

  // Always writes to the storage keys of the owner the data belongs to. The on-screen
  // state is updated only if that owner is still the current one.
  const persist = (next, forOwner = owner) => {
    if (ownerRef.current === forOwner) setRecords(next);
    AsyncStorage.setItem(storageKeys(forOwner).records, JSON.stringify(next));
  };

  const saveRecord = (avg, compatible) => {
    persist([{ id: String(Date.now()), name: session.name || 'Untitled session', location: session.location,
      date: new Date().toISOString(), avg, pref, compatible, areas, thresholdsVersion: THRESHOLDS_VERSION, synced: false }, ...records]);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
  };

  // Offline-first: records stay on the phone until Firebase confirms the upload.
  const sync = async () => {
    const syncOwner = owner; // remember who started this sync
    const pending = records.filter(r => !r.synced);
    if (!pending.length) return 0;
    const ids = await pushRecords(pending); // throws if offline, so records stay unsynced
    persist(records.map(r => (ids.includes(r.id) ? { ...r, synced: true } : r)), syncOwner);
    const t = new Date().toISOString();
    if (ownerRef.current === syncOwner) setLastSync(t);
    AsyncStorage.setItem(storageKeys(syncOwner).lastSync, t);
    return ids.length;
  };

  return (
    <Ctx.Provider value={{ owner, switchOwner, device, setDevice, areas, setAreas, session, setSession, pref, setPref, records, saveRecord, lastSync, sync }}>
      {children}
    </Ctx.Provider>
  );
}