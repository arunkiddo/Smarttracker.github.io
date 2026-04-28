interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

const model = "llama-3.1-8b-instant";

export default {
  async fetch(request: Request, env: Env) {
    const origin = env.ALLOWED_ORIGIN ?? "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = (await request.json()) as {
      description?: string;
      amount?: number;
      categories?: string[];
    };

    const prompt = `Classify this Indian bank transaction into one category.
Description: ${body.description ?? ""}
Amount: ${body.amount ?? 0}
Allowed categories: ${(body.categories ?? []).join(", ")}
Return only JSON with category, confidence from 0 to 1, and a short reason.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You categorize bank transactions for a personal finance app.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return new Response("Groq request failed", { status: 502, headers: corsHeaders });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    return new Response(content, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  },
};
