type GeminiPart = { text?: string };
type GeminiCandidate = {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
};
type GeminiResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
};

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY n’est pas configurée.");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    dailyLimit: Math.max(
      1,
      Number.parseInt(process.env.GEMINI_DAILY_LIMIT || "50", 10) || 50,
    ),
  };
}

export async function generateGeminiText(input: {
  systemInstruction: string;
  messages: Array<{ role: "user" | "model"; text: string }>;
}) {
  const { apiKey, model } = geminiConfig();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemInstruction }],
        },
        contents: input.messages.map((message) => ({
          role: message.role,
          parts: [{ text: message.text }],
        })),
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    const message = data.error?.message || `Gemini HTTP ${response.status}`;
    const quotaReached = response.status === 429 || /quota|rate limit/i.test(message);
    if (quotaReached) {
      throw new Error(
        "Le quota Gemini gratuit a été atteint. Réessayez plus tard.",
      );
    }
    throw new Error(message);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `La demande a été bloquée par Gemini : ${data.promptFeedback.blockReason}.`,
    );
  }

  const text = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini n’a retourné aucun texte exploitable.");
  }

  return text;
}
