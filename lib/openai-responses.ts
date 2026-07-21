type ResponseContent = {
  type?: string;
  text?: string;
};

type ResponseOutput = {
  type?: string;
  content?: ResponseContent[];
};

type OpenAIResponse = {
  output?: ResponseOutput[];
  error?: { message?: string };
};

export function openAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY n’est pas configurée.");
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  };
}

export async function createOpenAIResponse(payload: Record<string, unknown>) {
  const { apiKey, model } = openAIConfig();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, ...payload }),
    signal: AbortSignal.timeout(60_000),
  });

  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI HTTP ${response.status}`);
  }
  return data;
}

export function extractResponseText(data: OpenAIResponse): string {
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("La réponse IA ne contient aucun texte exploitable.");
}
