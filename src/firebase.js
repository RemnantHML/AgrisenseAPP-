import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, update, goOnline, goOffline } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(config);

let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app); // already initialized (e.g. fast refresh)
}

const db = getDatabase(app);
goOffline(db); // offline-first: never connect in the background

const withTimeout = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timed out')), ms))]);

export const isFirebaseConfigured = () => Boolean(config.apiKey && config.databaseURL && config.projectId);

// Uploads pending records in ONE batched write. Returns the ids Firebase confirmed.
export async function pushRecords(records) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured. Check your .env file.');
  goOnline(db);
  try {
    await auth.authStateReady?.();
    const user = auth.currentUser ?? (await withTimeout(signInAnonymously(auth), 12000, 'Sign-in')).user;

    const updates = {};
    records.forEach(({ synced, ...data }) => {
      updates[`logs/${user.uid}/${data.id}`] = { ...data, syncedAt: Date.now() };
    });
    await withTimeout(update(ref(db), updates), 15000, 'Upload');
    return records.map(r => r.id);
  } finally {
    goOffline(db);
  }
}