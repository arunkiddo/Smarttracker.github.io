import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const port = Number(process.env.PORT ?? 8787);
const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

loadLocalEnv();

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "text/plain" });
    response.end("Method not allowed");
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "GROQ_API_KEY is missing in .env.local" }));
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const categories = Array.isArray(body.categories) ? body.categories : [];
    const prompt = `Classify this Indian bank transaction into one category.
Description: ${body.description ?? ""}
Amount: ${body.amount ?? 0}
Allowed categories: ${categories.join(", ")}
Return only JSON with category, confidence from 0 to 1, and a short reason.`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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

    if (!groqResponse.ok) {
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Groq request failed" }));
      return;
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content ?? "{}";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(content);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
  }
});

server.listen(port, () => {
  console.log(`Groq test proxy running at http://localhost:${port}`);
});

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const env = readFileSync(envPath, "utf8");
  env.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  });
}
