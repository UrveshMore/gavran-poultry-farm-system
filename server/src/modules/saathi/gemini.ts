const MODEL = 'gemini-2.5-flash';

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function geminiJson(apiKey: string, parts: Part[], schema: object): Promise<unknown | null> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: schema },
        contents: [{ role: 'user', parts }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
