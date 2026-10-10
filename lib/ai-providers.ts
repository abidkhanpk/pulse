/**
 * Minimal provider adapters for the availability planner (plain fetch,
 * no SDKs). Each lab's incharge supplies their own API key; keys are
 * used server-side only and never logged or returned to clients.
 */

export type AiProviderId = "GEMINI" | "ANTHROPIC" | "OPENAI" | "XAI" | "GROQ";

export const AI_PROVIDERS: { id: AiProviderId; label: string; defaultModel: string }[] = [
  { id: "GEMINI", label: "Google Gemini", defaultModel: "gemini-2.5-flash" },
  { id: "ANTHROPIC", label: "Anthropic Claude", defaultModel: "claude-sonnet-4-5" },
  { id: "OPENAI", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { id: "XAI", label: "xAI Grok", defaultModel: "grok-4" },
  { id: "GROQ", label: "Groq", defaultModel: "llama-3.3-70b-versatile" },
];

export function defaultModelFor(provider: string): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "gemini-2.5-flash";
}

type CallResult = { ok: true; text: string } | { ok: false; error: string };

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 60_000
): Promise<{ status: number; json: Record<string, unknown> | null; raw: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* non-JSON error body */
    }
    return { status: res.status, json, raw };
  } finally {
    clearTimeout(timer);
  }
}

function providerError(provider: string, status: number, json: Record<string, unknown> | null, raw: string): CallResult {
  const errObj = (json?.error ?? null) as { message?: string } | null;
  const msg = errObj?.message ?? raw.slice(0, 200);
  return {
    ok: false,
    error: `${provider} request failed (HTTP ${status})${msg ? `: ${msg}` : ""}. Check the API key and model in the lab's AI settings.`,
  };
}

export async function callAi(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<CallResult> {
  try {
    if (provider === "GEMINI") {
      const { status, json, raw } = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": apiKey },
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }
      );
      if (status !== 200 || !json) return providerError("Gemini", status, json, raw);
      const candidates = (json.candidates ?? []) as { content?: { parts?: { text?: string }[] } }[];
      const text = (candidates[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      return text ? { ok: true, text } : { ok: false, error: "Gemini returned an empty answer." };
    }

    if (provider === "ANTHROPIC") {
      const { status, json, raw } = await postJson(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] }
      );
      if (status !== 200 || !json) return providerError("Claude", status, json, raw);
      const content = (json.content ?? []) as { type?: string; text?: string }[];
      const text = content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
      return text ? { ok: true, text } : { ok: false, error: "Claude returned an empty answer." };
    }

    if (provider === "OPENAI" || provider === "XAI" || provider === "GROQ") {
      const base =
        provider === "OPENAI"
          ? "https://api.openai.com/v1"
          : provider === "XAI"
            ? "https://api.x.ai/v1"
            : "https://api.groq.com/openai/v1";
      const label = provider === "OPENAI" ? "OpenAI" : provider === "XAI" ? "Grok" : "Groq";
      const { status, json, raw } = await postJson(
        `${base}/chat/completions`,
        { authorization: `Bearer ${apiKey}` },
        { model, messages: [{ role: "user", content: prompt }], max_tokens: 4096, temperature: 0.2 }
      );
      if (status !== 200 || !json) return providerError(label, status, json, raw);
      const choices = (json.choices ?? []) as { message?: { content?: string } }[];
      const text = (choices[0]?.message?.content ?? "").trim();
      return text ? { ok: true, text } : { ok: false, error: `${label} returned an empty answer.` };
    }

    return { ok: false, error: `Unknown AI provider: ${provider}` };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "The AI provider took too long to answer (60s timeout). Try again." };
    }
    return { ok: false, error: "Could not reach the AI provider. Check the server's internet connection and try again." };
  }
}
