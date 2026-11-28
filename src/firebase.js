import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { getDatabase, ref, update, onValue, goOnline, goOffline } from 'firebase/database';
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

const requireConfig = () => {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured. Check your .env file.');
};

// ---- Accounts (email + password). These need an internet connection. ----

export async function registerAccount(email, password) {
  requireConfig();
  const credential = await withTimeout(createUserWithEmailAndPassword(auth, email, password), 15000, 'Request');
  return credential.user;
}

export async function signInAccount(email, password) {
  requireConfig();
  const credential = await withTimeout(signInWithEmailAndPassword(auth, email, password), 15000, 'Request');
  return credential.user;
}

export async function resetPassword(email) {
  requireConfig();
  await withTimeout(sendPasswordResetEmail(auth, email), 15000, 'Request');
}

// Sign out of Firebase. Works offline. It does not touch records stored on the phone.
export async function signOutAccount() {
  await signOut(auth);
}

// Guest mode must not run while an email account is signed in, otherwise guest records
// could be uploaded under that account. Anonymous sessions are left alone, as before.
export async function prepareGuestSession() {
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    await signOut(auth);
  }
}

// Resolves when Firebase has finished reading any saved sign-in from the phone.
// Uses authStateReady when the SDK has it, otherwise waits for the first auth-state event.
const authReady = () =>
  typeof auth.authStateReady === 'function'
    ? auth.authStateReady()
    : new Promise(resolve => {
        let off = null;
        let fired = false;
        off = onAuthStateChanged(auth, () => {
          fired = true;
          off?.();
          resolve();
        });
        if (fired) off();
      });

// Called once when the app starts. Returns { uid, email } if an EMAIL account is still
// signed in on this phone, otherwise null. Anonymous (guest) sessions are ignored on
// purpose: guests still land on the login screen. It reads only what is saved on the
// phone, so it works offline, and it gives up after maxMs so the splash screen never hangs.
export async function restoreAccountSession(maxMs = 4000) {
  try {
    await withTimeout(authReady(), maxMs, 'Session check');
  } catch {
    return null;
  }
  const user = auth.currentUser;
  return user && !user.isAnonymous ? { uid: user.uid, email: user.email } : null;
}

// Email of the signed-in account, or null for guests / nobody signed in.
export function currentAccountEmail() {
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user.email : null;
}

// Turns a Firebase error into a short message a farmer can act on.
export function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try logging in instead.';
  if (code === 'auth/weak-password') return 'The password is too weak. Use at least 6 characters.';
  if (code === 'auth/network-request-failed') return 'No internet connection. Check your connection and try again.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if (code === 'auth/user-disabled') return 'This account has been disabled.';
  if (typeof error?.message === 'string' && error.message.endsWith('timed out')) {
    return 'The request timed out. Check your connection and try again.';
  }
  if (error?.message === 'Firebase is not configured. Check your .env file.') return error.message;
  return 'Something went wrong. Please try again.';
}

// Picks who the upload belongs to.
// ownerUid === null  -> guest: use the anonymous user (created on first sync, as before).
// ownerUid is a uid  -> that signed-in account only. Never falls back to anonymous.
async function userForUpload(ownerUid) {
  const current = auth.currentUser;
  if (ownerUid === null) {
    if (current && !current.isAnonymous) {
      throw new Error('An account is signed in. Choose Continue as guest on the login screen to sync guest records.');
    }
    return current ?? (await withTimeout(signInAnonymously(auth), 12000, 'Sign-in')).user;
  }
  if (!current || current.uid !== ownerUid) {
    throw new Error('Please log in again to sync this account.');
  }
  return current;
}

// ---- Deleting an uploaded record from the cloud ----
// Messages here are written for the user. They are shown as they are.
const MSG_OFFLINE = 'No internet connection. Connect to the internet to delete an uploaded record. Nothing was deleted.';
const MSG_LOGIN = 'Please log in again to delete this record. Nothing was deleted.';
const MSG_FAILED = 'The cloud copy could not be deleted, so the record was kept on this phone. Please try again.';

const friendly = message => Object.assign(new Error(message), { friendly: true });

// Resolves once Firebase reports it is connected (".info/connected" is true), otherwise
// rejects after maxMs. This is how we know we are really online BEFORE sending the delete.
const waitForConnection = maxMs =>
  new Promise((resolve, reject) => {
    let off = null;
    let finished = false;
    const done = (fn, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      off?.();
      fn(value);
    };
    const timer = setTimeout(() => done(reject, friendly(MSG_OFFLINE)), maxMs);
    off = onValue(
      ref(db, '.info/connected'),
      snapshot => { if (snapshot.val() === true) done(resolve); },
      () => done(reject, friendly(MSG_OFFLINE)),
    );
    if (finished) off();
  });

// Deletes logs/<ownerUid>/<recordId> from Firebase. Resolves only after Firebase confirms.
// Throws an Error whose message can be shown to the user; nothing is deleted on failure.
export async function deleteCloudRecord(ownerUid, recordId) {
  // A uid or id that is empty or contains / . # $ [ ] could point at the wrong path
  // (an empty id would mean "all of this user's records"), so refuse before doing anything.
  const safeKey = key => typeof key === 'string' && /^[^\/.#$\[\]]+$/.test(key);
  if (!safeKey(ownerUid) || !safeKey(recordId)) throw friendly(MSG_FAILED);
  try {
    requireConfig();
    goOnline(db);
    try {
      await auth.authStateReady?.();
      const user = auth.currentUser;
      // Only the signed-in EMAIL account that owns the records on screen may delete them.
      if (!user || user.isAnonymous || user.uid !== ownerUid) throw friendly(MSG_LOGIN);
      await waitForConnection(6000);
      await withTimeout(update(ref(db), { [`logs/${ownerUid}/${recordId}`]: null }), 15000, 'Delete');
    } finally {
      goOffline(db);
    }
  } catch (error) {
    throw error?.friendly ? error : friendly(MSG_FAILED);
  }
}

// Uploads pending records in ONE batched write. Returns the ids Firebase confirmed.
export async function pushRecords(records, ownerUid = null) {
  requireConfig();
  goOnline(db);
  try {
    await auth.authStateReady?.();
    const user = await userForUpload(ownerUid);

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