// Verified literal codes at Engine eef8ed0794046922842258ce587aab722db5fcb4:
// workflow.py:_workflow_failure_code and explicit WorkflowError(code=...),
// server.py:_stream_completion/stream_failure. Never accept a regex vocabulary.
export const upstreamSseErrorCodes = [
  "analysis_failed",
  "document_output_invalid",
  "internal_error",
  "invalid_generated_tool_call",
  "invalid_workflow_usage",
  "planning_failed",
  "retrieval_failed",
  "source_selection_failed",
  "strateg_terminal_persistence_failed",
  "strategy_failed",
  "terminal_validation_failed",
  "vertical_failed",
  "workflow_event_persistence_failed",
  "workflow_event_projection_invalid",
  "workflow_unexpected_failure",
  "writer_failed",
] as const;

export type UpstreamSseErrorCode = (typeof upstreamSseErrorCodes)[number] | "UNKNOWN";

export function upstreamSseErrorCode(value: unknown): UpstreamSseErrorCode {
  return typeof value === "string" &&
    upstreamSseErrorCodes.includes(value as (typeof upstreamSseErrorCodes)[number])
    ? (value as UpstreamSseErrorCode)
    : "UNKNOWN";
}
