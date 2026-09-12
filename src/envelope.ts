/**
 * C1 provider-side HeLaResult envelope (self-contained mirror of the canonical
 * shape in chaining-mcp/src/agent/hela-result.ts; this repo is a standalone
 * package and must not import across repos).
 *
 * Flag-gated: set HELA_ENVELOPE=true to wrap tool payloads in the canonical
 * HelaResult envelope. Default (unset/anything else) returns the legacy raw
 * payload byte-for-byte identical to before.
 */

export interface HelaArtifactRef {
  uri: string;
  sha256?: string;
  size?: number;
  media_type?: string;
}

export interface HelaProvenanceRef {
  source: string;
  retrieved_at?: string;
  confidence?: number;
  freshness?: string;
}

export interface HelaRedaction {
  applied: boolean;
  fields: string[];
}

export interface HelaExecutionMeta {
  serverName?: string;
  toolName?: string;
  run_id?: string;
  step_id?: string;
  attempt?: number;
  executionTimeMs?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface HelaResult<T = unknown> {
  ok: boolean;
  summary: string;
  /** Canonical payload field. */
  data: T;
  artifacts: HelaArtifactRef[];
  provenance: HelaProvenanceRef[];
  warnings: string[];
  sideEffects: string[];
  execution: HelaExecutionMeta;
  redaction: HelaRedaction;
  error?: string;
}

export const SERVER_NAME = "remote-ops-server";

/** Consequential tools declare their side effects; read-only tools declare none. */
export const TOOL_SIDE_EFFECTS: Record<string, string[]> = {
  execute_command: ["command-execution"],
  transfer_file: ["file-transfer"],
  terminal_ls: [],
  terminal_grep: [],
  terminal_cat: [],
};

export function isEnvelopeEnabled(): boolean {
  return process.env["HELA_ENVELOPE"] === "true";
}

function baseExecution(toolName: string): HelaExecutionMeta {
  const exec: HelaExecutionMeta = {
    serverName: SERVER_NAME,
    toolName,
    completedAt: new Date().toISOString(),
  };
  if (process.env["HELA_RUN_ID"] !== undefined) exec.run_id = process.env["HELA_RUN_ID"];
  if (process.env["HELA_STEP_ID"] !== undefined) exec.step_id = process.env["HELA_STEP_ID"];
  return exec;
}

export function wrapResult<T>(toolName: string, data: T, summary?: string): HelaResult<T> {
  return {
    ok: true,
    summary: summary || `${toolName} ok`,
    data,
    artifacts: [],
    provenance: [],
    warnings: [],
    sideEffects: TOOL_SIDE_EFFECTS[toolName] || [],
    execution: baseExecution(toolName),
    redaction: { applied: false, fields: [] },
  };
}

export function wrapError(toolName: string, message: string): HelaResult<null> {
  return {
    ok: false,
    summary: `${toolName} failed: ${message}`,
    data: null,
    artifacts: [],
    provenance: [],
    warnings: [],
    sideEffects: TOOL_SIDE_EFFECTS[toolName] || [],
    execution: baseExecution(toolName),
    redaction: { applied: false, fields: [] },
    error: message,
  };
}

function textBlock(text: string): { content: Array<{ type: string; text: string }> } {
  return { content: [{ type: "text", text }] };
}

/**
 * MCP tool-result responder. Envelope off (default): legacy raw JSON text,
 * byte-identical to the pre-C1 call sites (`JSON.stringify(payload, null, 2)`).
 */
export function textResult<T>(toolName: string, data: T, summary?: string) {
  if (!isEnvelopeEnabled()) return textBlock(JSON.stringify(data, null, 2));
  return textBlock(JSON.stringify(wrapResult(toolName, data, summary), null, 2));
}
