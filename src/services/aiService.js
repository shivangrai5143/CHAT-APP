/**
 * aiService.js
 * Gemini 1.5 Flash integration:
 *   - Smart replies
 *   - Chat summarization
 *   - Real-time translation
 *   - Voice note transcription  ← NEW
 *   - Semantic message search   ← NEW
 *
 * Setup: Add VITE_GEMINI_API_KEY=your_key_here to your .env file.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const PRO_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

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

// ─── Voice Note Transcription ─────────────────────────────────────────────────

/**
 * Transcribe an audio Blob to text using Gemini multimodal.
 * @param {Blob} audioBlob — webm/opus/mp4 audio blob
 * @returns {Promise<string|null>}
 */
export const transcribeVoiceNote = async (audioBlob) => {
  if (!API_KEY || !audioBlob) return null;
  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const base64 = window.btoa(binary);

    const mimeType = audioBlob.type || 'audio/webm';

    const body = {
      contents: [{
        parts: [
          { text: 'Transcribe the following audio accurately. Return ONLY the transcription text, nothing else.' },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    };

    const res = await fetch(`${PRO_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (e) {
    console.warn('[AI] Voice transcription error:', e);
    return null;
  }
};

// ─── Semantic Message Search ──────────────────────────────────────────────────

/**
 * Find messages relevant to a natural-language query.
 * Runs fully client-side — messages are already decrypted in memory.
 *
 * @param {string} query — e.g. "where we discussed deployment"
 * @param {{ id: string, text: string, senderName: string }[]} messages
 * @returns {Promise<string[]>} — array of matching message IDs
 */
export const semanticSearch = async (query, messages) => {
  if (!API_KEY || !query?.trim() || !messages?.length) return [];

  // Build a compact message list for Gemini
  const msgList = messages
    .filter((m) => m.text?.trim())
    .slice(-200) // cap to last 200 messages
    .map((m, i) => `[${i}|${m.id}] ${m.senderName}: ${m.text}`)
    .join('\n');

  if (!msgList) return [];

  const prompt = `You are a semantic search engine for a chat conversation.
Given the following messages (format: [index|id] sender: text), return the IDs of messages that are semantically relevant to the search query.

Search Query: "${query}"

Messages:
${msgList}

Return ONLY a JSON array of matching message IDs (the part after the pipe |). If no messages match, return []. No explanation.
Example: ["abc123", "def456"]`;

  try {
    const raw = await callGemini(prompt, 0.1, 256);
    if (!raw) return [];
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[AI] Semantic search error:', e);
    return [];
  }
};

// ─── Conversation Insights ────────────────────────────────────────────────────

/**
 * Generate AI-powered conversation insights.
 * @param {{ senderName: string, text: string }[]} messages
 * @returns {Promise<string|null>}
 */
export const getConversationInsights = async (messages) => {
  if (!messages?.length) return null;

  const convo = messages
    .slice(-80)
    .filter((m) => m.text)
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');

  if (!convo.trim()) return null;

  const prompt = `Analyze this chat conversation and provide:
1. 🎯 Main topics discussed
2. 😊 Overall tone/sentiment
3. ⚡ Key action items or decisions made
4. 💡 Notable insights

Conversation:
${convo}

Be concise and use bullet points.`;

  return callGemini(prompt, 0.4, 500);
};
