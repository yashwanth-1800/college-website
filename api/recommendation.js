import { generateText, Output } from "ai";
import { z } from "zod";
import { requireFirebaseUser } from "./_firebase-user.js";
import { allowWebClient } from "./_cors.js";

const recommendationSchema = z.object({
  summary: z.string().min(5).max(180),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(5).max(240),
  guidance: z.string().min(5).max(240),
  needsHumanReview: z.boolean(),
});

function clean(value, maximum) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

export default async function handler(request, response) {
  if (allowWebClient(request, response)) return;
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  try {
    await requireFirebaseUser(request, ["Student"]);
    const emergencyType = clean(request.body?.emergencyType, 40);
    const description = clean(request.body?.description, 300);
    const location = request.body?.location || {};
    if (!emergencyType || description.length < 5) return response.status(400).json({ error: "Valid incident details are required." });

    const { output, response: modelResponse } = await generateText({
      model: process.env.AI_MODEL || "openai/gpt-5-mini",
      output: Output.object({ schema: recommendationSchema }),
      system: "You assist trained campus emergency responders. Extract facts only from the report. Never diagnose, invent facts, give treatment instructions, or downplay danger. Choose the more cautious priority when uncertain. Critical means immediate threat to life or many people; High means serious or rapidly worsening risk; Medium means prompt assistance; Low means non-urgent. Human responders always make the final decision.",
      prompt: JSON.stringify({ emergencyType, description, location }),
    });

    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      ...output,
      source: "server-ai",
      model: process.env.AI_MODEL || "openai/gpt-5-mini",
      requestId: modelResponse?.id || crypto.randomUUID(),
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return response.status(status).json({ error: status >= 500 ? "The AI recommendation service is temporarily unavailable." : error.message });
  }
}

