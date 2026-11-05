// Thin client for the Gemini REST API. Every failure is thrown with a code the
// quiz explanation route can map to a status: AI_UNAVAILABLE, AI_BUSY, AI_TIMEOUT or AI_FAILED.
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20000;

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// gemini-2.5-flash is closed to new API keys; override with GEMINI_MODEL when Google retires this one too
export const geminiModel = (env = process.env) => env.GEMINI_MODEL || 'gemini-3.8-flash';

export function createGenerateJson(env = process.env, send = fetch) {
  return async function generateJson({ system, prompt, schema }) {
    if (!env.GEMINI_API_KEY) throw new AiError('AI_UNAVAILABLE', 'GEMINI_API_KEY is not set');
    let res;
    try {
      res = await send(`${ENDPOINT}/${encodeURIComponent(geminiModel(env))}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          // Low thinking cuts the wait from about 16s to about 5s; a short explanation needs little planning
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.7,
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      // A timeout and a network failure are both worth retrying later
      throw new AiError('AI_TIMEOUT', `Gemini request failed: ${error.name}`);
    }
    if (res.status === 429) throw new AiError('AI_BUSY', 'Gemini rate limit or quota reached');
    if (!res.ok) throw new AiError('AI_FAILED', `Gemini responded ${res.status}`);

    const body = await res.json().catch(() => null);
    const candidate = body?.candidates?.[0];
    if (candidate?.finishReason !== 'STOP')
      throw new AiError('AI_FAILED', `Gemini stopped early: ${candidate?.finishReason ?? 'no candidate'}`);
    const text = candidate.content?.parts?.map((part) => part.text ?? '').join('');
    try {
      return JSON.parse(text);
    } catch {
      throw new AiError('AI_FAILED', 'Gemini returned text that is not JSON');
    }
  };
}

export const generateJson = createGenerateJson();
