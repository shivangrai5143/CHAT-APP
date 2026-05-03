/**
 * aiService.js
 * Gemini 1.5 Flash integration — smart replies, summarization, translation.
 *
 * Setup: Add VITE_GEMINI_API_KEY=your_key_here to your .env file.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ─── Core request helper ──────────────────────────────────────────────────────

const callGemini = async (prompt, temperature = 0.7, maxTokens = 512) => {
  if (!API_KEY) {
    console.warn('[AI] VITE_GEMINI_API_KEY is not set. Add it to your .env file.');
    return null;
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
};

// ─── Smart Replies ────────────────────────────────────────────────────────────

/**
 * Generate 3 short, contextual reply suggestions.
 * @param {{ sender: 'me'|'them', text: string }[]} history — last few messages
 * @returns {Promise<string[]>}
 */
export const getSmartReplies = async (history) => {
  if (!history?.length) return [];

  const convo = history
    .slice(-6)
    .map((m) => `${m.sender === 'me' ? 'Me' : 'Them'}: ${m.text}`)
    .join('\n');

  const prompt = `You are a helpful chat assistant. Based on this conversation, suggest exactly 3 short, natural reply options for "Me". Each reply should be under 10 words.

Return ONLY a JSON array of 3 strings. No explanation, no markdown, just the JSON array.

Conversation:
${convo}

Example format: ["Sure!", "Sounds good to me", "Let me check and get back"]`;

  try {
    const raw = await callGemini(prompt, 0.8, 128);
    if (!raw) return [];
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch (e) {
    console.warn('[AI] Smart replies parse error:', e);
    return [];
  }
};

// ─── Chat Summarization ───────────────────────────────────────────────────────

/**
 * Summarize the last N messages into bullet points.
 * @param {{ senderName: string, text: string }[]} messages
 * @returns {Promise<string|null>}
 */
export const summarizeChat = async (messages) => {
  if (!messages?.length) return null;

  const convo = messages
    .slice(-60)
    .filter((m) => m.text)
    .map((m) => `${m.senderName || 'User'}: ${m.text}`)
    .join('\n');

  if (!convo.trim()) return 'No text messages to summarize.';

  const prompt = `Summarize this chat conversation in 3-5 concise bullet points. Focus on key topics, decisions, and important information shared. Use "•" for bullets.

Conversation:
${convo}

Summary:`;

  return callGemini(prompt, 0.4, 400);
};

// ─── Translation ──────────────────────────────────────────────────────────────

const LANG_NAMES = {
  en: 'English', hi: 'Hindi',   es: 'Spanish', fr: 'French',
  de: 'German',  ja: 'Japanese', ko: 'Korean',  zh: 'Chinese (Simplified)',
  ar: 'Arabic',  pt: 'Portuguese', ru: 'Russian', it: 'Italian',
};

export const SUPPORTED_LANGS = Object.entries(LANG_NAMES).map(([code, name]) => ({ code, name }));

/**
 * Translate text to the given language code.
 * @param {string} text
 * @param {string} targetLang — ISO 639-1 code e.g. 'hi', 'es'
 * @returns {Promise<string|null>}
 */
export const translateText = async (text, targetLang = 'en') => {
  if (!text?.trim()) return null;
  const langName = LANG_NAMES[targetLang] || targetLang;

  const prompt = `Translate the following text to ${langName}. Return ONLY the translated text with no explanation, quotes, or formatting.

Text: ${text}`;

  return callGemini(prompt, 0.3, 256);
};
