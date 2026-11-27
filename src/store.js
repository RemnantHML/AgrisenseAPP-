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
  const [loadId, setLoadId] = useState(0); // bumped on every switch so records reload even for the same owner
  const [device, setDevice] = useState(null);
  const [areas, setAreas] = useState(Array(N_AREAS).fill(null));
  const [session, setSession] = useState({ name: '', location: '' });
  const [pref, setPref] = useState('Rice');
  const [records, setRecords] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  // ---- Keeping records consistent ----
  // recordsRef always holds the LATEST records of the current owner. Every change is applied
  // to that latest list (never to a copy captured earlier), so a slow sync can no longer
  // overwrite a record saved, or bring back a record deleted, while it was running.
  const recordsRef = useRef([]);
  const loadedRef = useRef(false); // true once the current owner's stored records are loaded
  const queueRef = useRef(Promise.resolve()); // storage work runs strictly one after another
  const busyRef = useRef(false); // only one sync (or, later, one cloud deletion) at a time

  const enqueue = task => {
    queueRef.current = queueRef.current.then(task).catch(() => {});
    return queueRef.current;
  };

  // Applies `change` (list => new list) to the latest records of `forOwner` and saves the result.
  // Current owner (already loaded): updates the screen straight away. Otherwise (the owner
  // switched while the work was running, or the records are still loading) the change waits its
  // turn in the queue and is applied to the right list.
  const updateRecords = (forOwner, change) => {
    if (ownerRef.current === forOwner && loadedRef.current) {
      const next = change(recordsRef.current);
      recordsRef.current = next;
      setRecords(next);
      enqueue(() => AsyncStorage.setItem(storageKeys(forOwner).records, JSON.stringify(next)));
      return;
    }
    enqueue(async () => {
      if (ownerRef.current === forOwner && loadedRef.current) {
        updateRecords(forOwner, change);
        return;
      }
      const key = storageKeys(forOwner).records;
      const stored = await AsyncStorage.getItem(key);
      await AsyncStorage.setItem(key, JSON.stringify(change(stored ? JSON.parse(stored) : [])));
    });
  };

  // Load this owner's records. If the owner changes before a slow read finishes,
  // the old result is ignored so one owner's records never appear under another.
  useEffect(() => {
    let cancelled = false;
    const keys = storageKeys(owner);
    enqueue(async () => {
      const [storedRecords, storedSync] = await Promise.all([
        AsyncStorage.getItem(keys.records),
        AsyncStorage.getItem(keys.lastSync),
      ]);
      if (cancelled) return;
      const list = storedRecords ? JSON.parse(storedRecords) : [];
      recordsRef.current = list;
      loadedRef.current = true;
      setRecords(list);
      if (storedSync) setLastSync(storedSync);
    });
    return () => { cancelled = true; };
  }, [owner, loadId]);

  // Switching owner clears only what is held in memory (records on screen, sync time,
  // temporary readings, session text, preferred crop). Stored records are never deleted.
  const switchOwner = nextOwner => {
    ownerRef.current = nextOwner;
    recordsRef.current = [];
    loadedRef.current = false;
    setRecords([]);
    setLastSync(null);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
    setPref('Rice');
    setOwner(nextOwner);
    setLoadId(id => id + 1);
  };

  // amendments = the recommendations exactly as they were displayed when the user saved.
  // Older records (and callers that pass nothing) simply have no "amendments" field.
  const saveRecord = (avg, compatible, amendments) => {
    const record = { id: String(Date.now()), name: session.name || 'Untitled session', location: session.location,
      date: new Date().toISOString(), avg, pref, compatible, ...(Array.isArray(amendments) ? { amendments } : {}),
      areas, thresholdsVersion: THRESHOLDS_VERSION, synced: false };
    updateRecords(ownerRef.current, list => [record, ...list]);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
  };

  // Offline-first: records stay on the phone until Firebase confirms the upload.
  const sync = async () => {
    if (busyRef.current) throw new Error('A sync or deletion is already running. Please wait a moment and try again.');
    const syncOwner = ownerRef.current; // remember who started this sync
    const pending = recordsRef.current.filter(r => !r.synced);
    if (!pending.length) return 0;
    busyRef.current = true;
    try {
      const ids = await pushRecords(pending, syncOwner === GUEST_OWNER ? null : syncOwner); // throws if offline, so records stay unsynced
      // Mark only the uploaded records, on the LATEST list (records saved or deleted meanwhile are respected).
      updateRecords(syncOwner, list => list.map(r => (ids.includes(r.id) ? { ...r, synced: true } : r)));
      const t = new Date().toISOString();
      if (ownerRef.current === syncOwner) setLastSync(t);
      enqueue(() => AsyncStorage.setItem(storageKeys(syncOwner).lastSync, t));
      return ids.length;
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <Ctx.Provider value={{ owner, switchOwner, device, setDevice, areas, setAreas, session, setSession, pref, setPref, records, saveRecord, lastSync, sync }}>
      {children}
    </Ctx.Provider>
  );
}