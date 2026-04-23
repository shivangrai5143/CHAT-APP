// ─── Wallpaper Presets ────────────────────────────────────────────────────────
export const PRESET_WALLPAPERS = [
  { id: 'none',     label: 'Default',  style: { background: '#0f172a' } },
  { id: 'dots',     label: 'Dots',     style: { backgroundColor: '#0f172a', backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '24px 24px' } },
  { id: 'grid',     label: 'Grid',     style: { backgroundColor: '#0f172a', backgroundImage: 'linear-gradient(rgba(99,102,241,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.08) 1px,transparent 1px)', backgroundSize: '32px 32px' } },
  { id: 'diagonal', label: 'Lines',    style: { backgroundColor: '#0f172a', backgroundImage: 'repeating-linear-gradient(45deg,rgba(99,102,241,.07) 0px,rgba(99,102,241,.07) 1px,transparent 1px,transparent 12px)' } },
  { id: 'bubbles',  label: 'Bubbles',  style: { backgroundColor: '#0f172a', backgroundImage: 'radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,.10) 0%,transparent 50%)' } },
  { id: 'aurora',   label: 'Aurora',   style: { background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 30%,#0f172a 60%,#172554 100%)' } },
  { id: 'midnight', label: 'Midnight', style: { background: 'linear-gradient(160deg,#020617 0%,#0c1445 50%,#020617 100%)' } },
  { id: 'forest',   label: 'Forest',   style: { background: 'linear-gradient(135deg,#022c22 0%,#064e3b 50%,#0f172a 100%)' } },
];

export const GRADIENT_WALLPAPERS = [
  { id: 'grad-sunset',  label: 'Sunset',  style: { background: 'linear-gradient(135deg,#1a0000 0%,#3d1a00 50%,#1a0a1a 100%)' } },
  { id: 'grad-ocean',   label: 'Ocean',   style: { background: 'linear-gradient(135deg,#001a2c 0%,#003366 50%,#001a2c 100%)' } },
  { id: 'grad-cosmos',  label: 'Cosmos',  style: { background: 'linear-gradient(135deg,#0d001a 0%,#1a0033 40%,#000d1a 100%)' } },
  { id: 'grad-ember',   label: 'Ember',   style: { background: 'linear-gradient(135deg,#1a0000 0%,#4d1a00 60%,#1a0500 100%)' } },
  { id: 'grad-arctic',  label: 'Arctic',  style: { background: 'linear-gradient(135deg,#001a33 0%,#003d4d 50%,#001a33 100%)' } },
  { id: 'grad-volcano', label: 'Volcano', style: { background: 'linear-gradient(135deg,#1a0000 0%,#660000 40%,#1a0000 100%)' } },
];

export const SOLID_COLORS = [
  { id: 'solid-slate',   label: 'Slate',   color: '#0f172a' },
  { id: 'solid-zinc',    label: 'Zinc',    color: '#18181b' },
  { id: 'solid-navy',    label: 'Navy',    color: '#0a0f2c' },
  { id: 'solid-forest',  label: 'Forest',  color: '#052e16' },
  { id: 'solid-maroon',  label: 'Maroon',  color: '#4c0519' },
  { id: 'solid-indigo',  label: 'Indigo',  color: '#1e1b4b' },
  { id: 'solid-teal',    label: 'Teal',    color: '#042f2e' },
  { id: 'solid-purple',  label: 'Purple',  color: '#2e1065' },
  { id: 'solid-brown',   label: 'Brown',   color: '#1c0a00' },
  { id: 'solid-black',   label: 'Black',   color: '#000000' },
  { id: 'solid-gray',    label: 'Gray',    color: '#111827' },
  { id: 'solid-charcoal',label: 'Charcoal',color: '#1a1a2e' },
];

// ─── Theme Presets ────────────────────────────────────────────────────────────
export const THEME_PRESETS = [
  {
    id: 'dark',
    label: 'Dark',
    emoji: '🌙',
    description: 'Default dark theme',
    vars: {
      '--c-accent':          '#6366f1',
      '--c-bubble-me':       '#4f46e5',
      '--c-bubble-them':     '#1e293b',
      '--c-bubble-me-text':  '#ffffff',
      '--c-bubble-them-text':'#e2e8f0',
      '--c-bg-primary':      '#0f172a',
      '--c-bg-secondary':    '#1e293b',
      '--c-text-primary':    '#f1f5f9',
      '--c-text-secondary':  '#94a3b8',
    },
    dataTheme: 'dark',
  },
  {
    id: 'light',
    label: 'Light',
    emoji: '☀️',
    description: 'Clean light theme',
    vars: {
      '--c-accent':          '#6366f1',
      '--c-bubble-me':       '#6366f1',
      '--c-bubble-them':     '#e2e8f0',
      '--c-bubble-me-text':  '#ffffff',
      '--c-bubble-them-text':'#1e293b',
      '--c-bg-primary':      '#f0f4f8',
      '--c-bg-secondary':    '#ffffff',
      '--c-text-primary':    '#0f172a',
      '--c-text-secondary':  '#475569',
    },
    dataTheme: 'light',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    emoji: '💬',
    description: 'Classic green chat',
    vars: {
      '--c-accent':          '#00a884',
      '--c-bubble-me':       '#005c4b',
      '--c-bubble-them':     '#202c33',
      '--c-bubble-me-text':  '#e9edef',
      '--c-bubble-them-text':'#e9edef',
      '--c-bg-primary':      '#111b21',
      '--c-bg-secondary':    '#202c33',
      '--c-text-primary':    '#e9edef',
      '--c-text-secondary':  '#8696a0',
    },
    dataTheme: 'dark',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    emoji: '✈️',
    description: 'Classic blue chat',
    vars: {
      '--c-accent':          '#2b5278',
      '--c-bubble-me':       '#2b5278',
      '--c-bubble-them':     '#182533',
      '--c-bubble-me-text':  '#ffffff',
      '--c-bubble-them-text':'#ffffff',
      '--c-bg-primary':      '#17212b',
      '--c-bg-secondary':    '#232e3c',
      '--c-text-primary':    '#ffffff',
      '--c-text-secondary':  '#708898',
    },
    dataTheme: 'dark',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    emoji: '🔮',
    description: 'Deep purple night',
    vars: {
      '--c-accent':          '#8b5cf6',
      '--c-bubble-me':       '#6d28d9',
      '--c-bubble-them':     '#1e1b4b',
      '--c-bubble-me-text':  '#ffffff',
      '--c-bubble-them-text':'#ddd6fe',
      '--c-bg-primary':      '#0d001a',
      '--c-bg-secondary':    '#1a0033',
      '--c-text-primary':    '#ede9fe',
      '--c-text-secondary':  '#a78bfa',
    },
    dataTheme: 'dark',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    emoji: '🌅',
    description: 'Warm amber vibes',
    vars: {
      '--c-accent':          '#f59e0b',
      '--c-bubble-me':       '#b45309',
      '--c-bubble-them':     '#292524',
      '--c-bubble-me-text':  '#fffbeb',
      '--c-bubble-them-text':'#fef3c7',
      '--c-bg-primary':      '#1c0a00',
      '--c-bg-secondary':    '#292524',
      '--c-text-primary':    '#fef9c3',
      '--c-text-secondary':  '#fbbf24',
    },
    dataTheme: 'dark',
  },
];

// ─── Apply CSS Variables to :root ────────────────────────────────────────────
export const applyThemeVars = (vars, dataTheme = 'dark') => {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', dataTheme);
};

// ─── Cloudinary Image Upload ─────────────────────────────────────────────────
export const uploadWallpaperImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'Chat_Images');

  const res = await fetch('https://api.cloudinary.com/v1_1/du3hiflqj/image/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Cloudinary upload failed');

  // Return a compressed/optimized URL via Cloudinary transforms
  return data.secure_url.replace('/upload/', '/upload/q_auto,f_auto,w_1920/');
};

// ─── Build wallpaper style object from stored preference ─────────────────────
export const buildWallpaperStyle = (pref) => {
  if (!pref || pref.type === 'preset') {
    const wp = PRESET_WALLPAPERS.find((w) => w.id === (pref?.value || 'none'));
    return wp?.style || { background: '#0f172a' };
  }
  if (pref.type === 'gradient') {
    const wp = GRADIENT_WALLPAPERS.find((w) => w.id === pref.value);
    return wp?.style || { background: '#0f172a' };
  }
  if (pref.type === 'solid') {
    return { background: pref.value };
  }
  if (pref.type === 'image') {
    return {
      backgroundImage: `url("${pref.value}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  return { background: '#0f172a' };
};
