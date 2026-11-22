import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { N_AREAS, THRESHOLDS_VERSION } from './data';
import { pushRecords } from './firebase';
const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [device, setDevice] = useState(null);
  const [areas, setAreas] = useState(Array(N_AREAS).fill(null));
  const [session, setSession] = useState({ name: '', location: '' });
  const [pref, setPref] = useState('Rice');
  const [records, setRecords] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('records').then(v => v && setRecords(JSON.parse(v)));
    AsyncStorage.getItem('lastSync').then(v => v && setLastSync(v));
  }, []);

  const persist = r => { setRecords(r); AsyncStorage.setItem('records', JSON.stringify(r)); };

  const saveRecord = (avg, compatible) => {
    persist([{ id: String(Date.now()), name: session.name || 'Untitled session', location: session.location,
      date: new Date().toISOString(), avg, pref, compatible, areas, thresholdsVersion: THRESHOLDS_VERSION, synced: false }, ...records]);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
  };

// Offline-first: records stay on the phone until Firebase confirms the upload.
const sync = async () => {
  const pending = records.filter(r => !r.synced);
  if (!pending.length) return 0;
  const ids = await pushRecords(pending); // throws if offline, so records stay unsynced
  persist(records.map(r => (ids.includes(r.id) ? { ...r, synced: true } : r)));
  const t = new Date().toISOString();
  setLastSync(t); AsyncStorage.setItem('lastSync', t);
  return ids.length;
};

  return (
    <Ctx.Provider value={{ device, setDevice, areas, setAreas, session, setSession, pref, setPref, records, saveRecord, lastSync, sync }}>
      {children}
    </Ctx.Provider>
  );
}
