import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { N_AREAS } from './data';

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
      date: new Date().toISOString(), avg, pref, compatible, synced: false }, ...records]);
    setAreas(Array(N_AREAS).fill(null));
    setSession({ name: '', location: '' });
  };

  // Offline-first: records live on the phone; replace the body with a Firebase write when ready.
  const sync = async () => {
    const pending = records.filter(r => !r.synced);
    // TODO: await Promise.all(pending.map(r => push(ref(db, `logs/${r.id}`), r)));
    persist(records.map(r => ({ ...r, synced: true })));
    const t = new Date().toISOString();
    setLastSync(t); AsyncStorage.setItem('lastSync', t);
    return pending.length;
  };

  return (
    <Ctx.Provider value={{ device, setDevice, areas, setAreas, session, setSession, pref, setPref, records, saveRecord, lastSync, sync }}>
      {children}
    </Ctx.Provider>
  );
}
