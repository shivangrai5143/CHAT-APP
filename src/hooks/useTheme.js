import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PRESET_WALLPAPERS, THEME_PRESETS,
  applyThemeVars, buildWallpaperStyle,
} from '../services/wallpaperService';
import { loadUserPreferences, saveUserPreferences } from '../services/themeService';

const LS_KEY = 'chat-theme-prefs';

const DEFAULT_PREFS = {
  wallpaper:   { type: 'preset', value: 'none' },
  blur:        0,
  opacity:     1,
  themeId:     'dark',
  chatWallpapers: {}, // { [chatId]: { type, value } }
};

const readLocalPrefs = () => {
  try { 
    const data = JSON.parse(localStorage.getItem(LS_KEY));
    if (data && data.wallpaper && !data.wallpaper.value) {
      data.wallpaper = { type: 'preset', value: 'none' };
    }
    return data || DEFAULT_PREFS; 
  }
  catch { return DEFAULT_PREFS; }
};

export const useTheme = (userId) => {
  const [prefs, setPrefs] = useState(readLocalPrefs);
  const saveTimer = useRef(null);

  // ── Derived values ──────────────────────────────────────────────────────────
  const wallpaperStyle = buildWallpaperStyle(prefs.wallpaper);
  const currentTheme   = THEME_PRESETS.find((t) => t.id === prefs.themeId) || THEME_PRESETS[0];

  // ── Apply CSS variables whenever theme changes ───────────────────────────────
  useEffect(() => {
    applyThemeVars(currentTheme.vars, currentTheme.dataTheme);
  }, [prefs.themeId]); // eslint-disable-line

  // ── Load from Firestore on login ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadUserPreferences(userId).then((remote) => {
      if (!remote?.theme) return;
      const merged = { ...DEFAULT_PREFS, ...remote.theme };
      setPrefs(merged);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    });
  }, [userId]);

  // ── Persist helper (debounced Firestore write) ───────────────────────────────
  const persist = useCallback((next) => {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveUserPreferences(userId, { theme: next });
    }, 1500);
  }, [userId]);

  // ── Public updaters ─────────────────────────────────────────────────────────
  const setWallpaper = useCallback((type, value) => {
    if (value === undefined) return; // safeguard against invalid data
    setPrefs((p) => {
      const next = { ...p, wallpaper: { type, value } };
      persist(next);
      return next;
    });
  }, [persist]);

  const setBlur = useCallback((v) => {
    setPrefs((p) => { const next = { ...p, blur: v }; persist(next); return next; });
  }, [persist]);

  const setOpacity = useCallback((v) => {
    setPrefs((p) => { const next = { ...p, opacity: v }; persist(next); return next; });
  }, [persist]);

  const setTheme = useCallback((themeId) => {
    setPrefs((p) => { const next = { ...p, themeId }; persist(next); return next; });
  }, [persist]);

  const setChatWallpaper = useCallback((chatId, wp) => {
    setPrefs((p) => {
      const next = { ...p, chatWallpapers: { ...p.chatWallpapers, [chatId]: wp } };
      persist(next);
      return next;
    });
  }, [persist]);

  const resetToDefault = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    persist(DEFAULT_PREFS);
  }, [persist]);

  // Legacy support — old code called setWallpaper(id) with just a preset id
  const setWallpaperById = useCallback((id) => {
    setWallpaper('preset', id);
  }, [setWallpaper]);

  return {
    // State
    prefs,
    wallpaperStyle,
    blur:       prefs.blur,
    opacity:    prefs.opacity,
    themeId:    prefs.themeId,
    currentTheme,
    wallpaperId: prefs.wallpaper?.value || 'none',
    chatWallpapers: prefs.chatWallpapers || {},

    // Wallpaper array (for UserPanel swatch grid — legacy support)
    wallpapers: PRESET_WALLPAPERS,

    // Updaters
    setWallpaper,
    setWallpaperById,   // legacy alias
    setBlur,
    setOpacity,
    setTheme,
    setChatWallpaper,
    resetToDefault,
  };
};
