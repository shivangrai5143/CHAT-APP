import React, { useState, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContextProvider';
import {
  PRESET_WALLPAPERS, GRADIENT_WALLPAPERS, SOLID_COLORS,
  THEME_PRESETS, uploadWallpaperImage, buildWallpaperStyle,
} from '../../services/wallpaperService';
import { toast } from 'react-toastify';
import assets from '../../assets/assets';

// ─── Sub-components ───────────────────────────────────────────────────────────

const NavItem = ({ id, label, icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <span className="text-lg">{icon}</span>
    {label}
  </button>
);

const RangeSlider = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}{unit}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value ?? min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full accent-indigo-500 cursor-pointer"
    />
    <div className="flex justify-between text-xs text-slate-600">
      <span>{min}{unit}</span><span>{max}{unit}</span>
    </div>
  </div>
);

// ─── Live Preview ─────────────────────────────────────────────────────────────
const LivePreview = ({ wallpaperStyle, blur, opacity, themeVars }) => {
  const bubbleMeStyle   = { backgroundColor: themeVars?.['--c-bubble-me']   || '#4f46e5', color: themeVars?.['--c-bubble-me-text']   || '#fff' };
  const bubbleThemStyle = { backgroundColor: themeVars?.['--c-bubble-them']  || '#1e293b', color: themeVars?.['--c-bubble-them-text'] || '#e2e8f0' };

  return (
    <div className="sticky top-6">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-semibold">Live Preview</p>
      <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl" style={{ height: 380 }}>
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800/90 border-b border-slate-700/50">
          <img src={assets.profile_img || assets.avatar_icon} className="w-7 h-7 rounded-full" alt="" />
          <div>
            <p className="text-xs font-semibold text-slate-200">Harshu</p>
            <p className="text-[10px] text-green-400">Online</p>
          </div>
        </div>

        {/* Messages area */}
        <div className="relative h-[268px] overflow-hidden">
          {/* Wallpaper layer */}
          <div
            className="absolute inset-0"
            style={{ ...wallpaperStyle, opacity, filter: blur > 0 ? `blur(${blur}px)` : undefined }}
          />
          {/* Messages */}
          <div className="relative z-10 p-3 flex flex-col gap-2 h-full overflow-hidden">
            <div className="flex justify-start">
              <div className="max-w-[70%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs" style={bubbleThemStyle}>
                Hey! How's it going? 👋
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[70%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs" style={bubbleMeStyle}>
                All good! Love this new theme 🎨
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[70%] px-3 py-1.5 rounded-2xl rounded-tl-sm text-xs" style={bubbleThemStyle}>
                Looks amazing! 🔥
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[70%] px-3 py-1.5 rounded-2xl rounded-tr-sm text-xs" style={bubbleMeStyle}>
                Thanks 😊
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/90 border-t border-slate-700/50">
          <div className="flex-1 bg-slate-700/50 rounded-full px-3 py-1.5 text-xs text-slate-500">
            Type a message…
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: themeVars?.['--c-accent'] || '#6366f1' }}>
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Wallpaper Section ────────────────────────────────────────────────────────
const WallpaperSection = ({ prefs, setWallpaper, blur, setBlur, opacity, setOpacity, resetToDefault, onPreview }) => {
  const [tab, setTab] = useState('preset');
  const [uploading, setUploading] = useState(false);
  const [customColor, setCustomColor] = useState('#1a1a2e');
  const fileRef = useRef(null);

  const tabs = [
    { id: 'preset',   label: 'Patterns' },
    { id: 'gradient', label: 'Gradients' },
    { id: 'solid',    label: 'Colors' },
    { id: 'image',    label: 'Custom' },
  ];

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    try {
      setUploading(true);
      const url = await uploadWallpaperImage(file);
      setWallpaper('image', url);
      onPreview('image', url);
      toast.success('Wallpaper uploaded!');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSolidCustom = (color) => {
    setCustomColor(color);
    setWallpaper('solid', color);
    onPreview('solid', color);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Chat Wallpaper</h2>
        <p className="text-sm text-slate-400">Choose a background for your chat window</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Preset Patterns */}
      {tab === 'preset' && (
        <div className="grid grid-cols-4 gap-3">
          {PRESET_WALLPAPERS.map((wp) => (
            <button key={wp.id} title={wp.label}
              onClick={() => { setWallpaper('preset', wp.id); onPreview('preset', wp.id); }}
              className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${prefs.wallpaper?.type === 'preset' && prefs.wallpaper?.value === wp.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/30 scale-105' : 'border-slate-700 hover:border-slate-500'}`}
              style={wp.style}
            >
              <span className="absolute bottom-1 inset-x-0 text-center text-[9px] text-white/70">{wp.label}</span>
              {prefs.wallpaper?.type === 'preset' && prefs.wallpaper?.value === wp.id && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] text-white">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Gradients */}
      {tab === 'gradient' && (
        <div className="grid grid-cols-3 gap-3">
          {GRADIENT_WALLPAPERS.map((wp) => (
            <button key={wp.id} title={wp.label}
              onClick={() => { setWallpaper('gradient', wp.id); onPreview('gradient', wp.id); }}
              className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${prefs.wallpaper?.type === 'gradient' && prefs.wallpaper?.value === wp.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/30 scale-105' : 'border-slate-700 hover:border-slate-500'}`}
              style={wp.style}
            >
              <span className="absolute bottom-1.5 inset-x-0 text-center text-xs text-white/80 font-medium drop-shadow">{wp.label}</span>
              {prefs.wallpaper?.type === 'gradient' && prefs.wallpaper?.value === wp.id && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] text-white">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Solid Colors */}
      {tab === 'solid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {SOLID_COLORS.map((c) => (
              <button key={c.id} title={c.label}
                onClick={() => { setWallpaper('solid', c.color); onPreview('solid', c.color); }}
                className={`h-10 rounded-xl border-2 transition-all hover:scale-110 ${prefs.wallpaper?.type === 'solid' && prefs.wallpaper?.value === c.color ? 'border-indigo-500 scale-110 shadow-lg' : 'border-slate-700'}`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 bg-slate-800/60 p-3 rounded-xl">
            <label className="text-sm text-slate-300 flex-1">Custom color</label>
            <div className="relative">
              <input type="color" value={customColor} onChange={(e) => handleSolidCustom(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-600 bg-transparent" />
            </div>
            <span className="text-sm font-mono text-slate-400">{customColor}</span>
          </div>
        </div>
      )}

      {/* Custom Image Upload */}
      {tab === 'image' && (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 h-36 border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-2xl cursor-pointer transition-colors group"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Uploading…</p>
              </div>
            ) : (
              <>
                <span className="text-3xl group-hover:scale-110 transition-transform">🖼️</span>
                <p className="text-sm text-slate-300 font-medium">Click to upload image</p>
                <p className="text-xs text-slate-500">PNG, JPG — max 5 MB</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
          </div>
          {prefs.wallpaper?.type === 'image' && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl">
              <img src={prefs.wallpaper.value} className="w-12 h-12 rounded-lg object-cover" alt="" loading="lazy" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 font-medium truncate">Custom wallpaper</p>
                <p className="text-xs text-green-400">✓ Applied</p>
              </div>
              <button onClick={() => { setWallpaper('preset', 'none'); onPreview('preset', 'none'); }}
                className="text-xs text-red-400 hover:text-red-300">Remove</button>
            </div>
          )}
        </div>
      )}

      {/* Blur + Opacity controls */}
      <div className="space-y-5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
        <p className="text-sm font-semibold text-slate-300">Adjustments</p>
        <RangeSlider label="Blur"    value={blur}    min={0}   max={20}  step={1}   unit="px" onChange={setBlur} />
        <RangeSlider label="Opacity" value={opacity} min={0.2} max={1}   step={0.05} unit=""  onChange={setOpacity} />
      </div>

      <button onClick={resetToDefault}
        className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
        ↩ Reset to default
      </button>
    </div>
  );
};

// ─── Theme Section ────────────────────────────────────────────────────────────
const ThemeSection = ({ themeId, setTheme, onPreviewTheme }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-white mb-1">App Theme</h2>
      <p className="text-sm text-slate-400">Choose a color scheme for the entire app</p>
    </div>

    <div className="grid grid-cols-1 gap-3">
      {THEME_PRESETS.map((t) => {
        const isActive = themeId === t.id;
        return (
          <button key={t.id}
            onClick={() => { setTheme(t.id); onPreviewTheme(t); }}
            className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${isActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'}`}
          >
            {/* Color swatches */}
            <div className="flex gap-1.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg border border-white/10" style={{ background: t.vars['--c-bg-primary'] }} />
              <div className="w-8 h-8 rounded-lg border border-white/10" style={{ background: t.vars['--c-bubble-me'] }} />
              <div className="w-8 h-8 rounded-lg border border-white/10" style={{ background: t.vars['--c-accent'] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.emoji}</span>
                <span className="font-semibold text-slate-200">{t.label}</span>
                {isActive && <span className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
            </div>
            {isActive && (
              <span className="text-indigo-400 text-lg flex-shrink-0">✓</span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Main Settings Page ───────────────────────────────────────────────────────
const SettingsPage = () => {
  const navigate   = useNavigate();
  const {
    prefs, wallpaperStyle, blur, opacity,
    setWallpaper, setBlur, setOpacity,
    setTheme, themeId, currentTheme,
    resetToDefault,
  } = useContext(AppContext);

  const [section, setSection] = useState('wallpaper');

  // Preview state — separate from applied state for live preview
  const [previewWallpaperStyle, setPreviewWallpaperStyle] = useState(wallpaperStyle);
  const [previewBlur,    setPreviewBlur]    = useState(blur);
  const [previewOpacity, setPreviewOpacity] = useState(opacity);
  const [previewThemeVars, setPreviewThemeVars] = useState(currentTheme?.vars || {});

  const handlePreviewWallpaper = useCallback((type, value) => {
    setPreviewWallpaperStyle(buildWallpaperStyle({ type, value }));
  }, []);

  const handlePreviewTheme = useCallback((t) => {
    setPreviewThemeVars(t.vars);
  }, []);

  const nav = [
    { id: 'wallpaper', label: 'Wallpaper', icon: '🖼️' },
    { id: 'theme',     label: 'Theme',     icon: '🎨' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <button onClick={() => navigate('/chat')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to chat
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="flex max-w-5xl mx-auto px-4 py-8 gap-8">
        {/* ── Left nav ── */}
        <aside className="w-48 flex-shrink-0 space-y-1">
          {nav.map((n) => (
            <NavItem key={n.id} {...n} active={section === n.id} onClick={setSection} />
          ))}
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 min-w-0">
          {section === 'wallpaper' && (
            <WallpaperSection
              prefs={prefs}
              setWallpaper={(t, v) => { setWallpaper(t, v); handlePreviewWallpaper(t, v); }}
              blur={blur}        setBlur={(v)  => { setBlur(v);    setPreviewBlur(v); }}
              opacity={opacity}  setOpacity={(v) => { setOpacity(v); setPreviewOpacity(v); }}
              resetToDefault={() => { resetToDefault(); setPreviewWallpaperStyle(buildWallpaperStyle({ type: 'preset', value: 'none' })); setPreviewBlur(0); setPreviewOpacity(1); }}
              onPreview={handlePreviewWallpaper}
            />
          )}
          {section === 'theme' && (
            <ThemeSection
              themeId={themeId}
              setTheme={setTheme}
              onPreviewTheme={handlePreviewTheme}
            />
          )}
        </main>

        {/* ── Sticky Live Preview ── */}
        <aside className="w-56 flex-shrink-0 hidden lg:block">
          <LivePreview
            wallpaperStyle={previewWallpaperStyle}
            blur={previewBlur}
            opacity={previewOpacity}
            themeVars={previewThemeVars}
          />
        </aside>
      </div>
    </div>
  );
};

export default SettingsPage;
