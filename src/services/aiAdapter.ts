import OpenAI from "openai";
import { config } from "../config";
import { buildHeuristicPrediction } from "./riskEngine";
import type { PipelineBuilderConfig, PredictionResult, TelemetryRecord } from "../types";

function extractJsonCandidate(content: string): string | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return content.slice(start, end + 1);
}

export class AiAdapter {
  async predict(telemetry: TelemetryRecord, builder: PipelineBuilderConfig): Promise<PredictionResult> {
    const heuristic = buildHeuristicPrediction(telemetry, builder);

    if (
      config.ai.mode !== "0g-openai-compatible" ||
      !config.ai.baseURL ||
      !config.ai.apiKey
    ) {
      return {
        shipmentId: telemetry.shipmentId,
        scoredAt: new Date().toISOString(),
        provider: config.ai.mode === "mock" ? "mock" : "heuristic-fallback",
        modelUsed: config.ai.mode === "mock" ? "mock-0g-builder" : "local-risk-engine",
        ...heuristic,
      };
    }

    try {
      const client = new OpenAI({
        baseURL: config.ai.baseURL,
        apiKey: config.ai.apiKey,
      });

      const completion = await client.chat.completions.create({
        model: config.ai.model,
        temperature: config.ai.temperature,
        messages: [
          {
            role: "system",
            content:
              "You analyze logistics sensor data. Reply with JSON only: {\"summary\":string,\"recommendedAction\":string,\"riskScore\":number}. Keep summary concise and operational.",
          },
          {
            role: "user",
            content: JSON.stringify({
              telemetry,
              thresholds: builder,
              heuristic,
            }),
          },
        ],
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const jsonCandidate = extractJsonCandidate(content);
      if (!jsonCandidate) {
        throw new Error("AI response tidak mengandung JSON.");
      }

      const parsed = JSON.parse(jsonCandidate) as {
        summary?: string;
        recommendedAction?: string;
        riskScore?: number;
      };

      const riskScore =
        typeof parsed.riskScore === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.riskScore)))
          : heuristic.riskScore;

      return {
        shipmentId: telemetry.shipmentId,
        scoredAt: new Date().toISOString(),
        provider: "0g-openai-compatible",
        modelUsed: config.ai.model,
        riskScore,
        alertLevel:
          riskScore >= builder.criticalRiskScore
            ? "critical"
            : riskScore >= 35
              ? "warning"
              : "normal",
        ruleBreaks: heuristic.ruleBreaks,
        recommendedAction: parsed.recommendedAction || heuristic.recommendedAction,
        summary: parsed.summary || heuristic.summary,
      };
    } catch (error) {
      return {
        shipmentId: telemetry.shipmentId,
        scoredAt: new Date().toISOString(),
        provider: "heuristic-fallback",
        modelUsed: `fallback-after-error:${config.ai.model}`,
        ...heuristic,
        summary: `${heuristic.summary} Fallback dipakai karena AI provider gagal: ${(error as Error).message}`,
      };
    }
  }
}
