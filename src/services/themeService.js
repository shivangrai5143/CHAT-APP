import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const COL = 'userPreferences';

export const loadUserPreferences = async (userId) => {
  if (!userId) return null;
  try {
    const snap = await getDoc(doc(db, COL, userId));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('[themeService] load:', e);
    return null;
  }
};

export const saveUserPreferences = async (userId, prefs) => {
  if (!userId) return;
  try {
    await setDoc(doc(db, COL, userId), prefs, { merge: true });
  } catch (e) {
    console.error('[themeService] save:', e);
  }
};
