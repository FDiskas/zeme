// Why an upstream lookup failed, in words a reader can act on: the report
// shows it beside the source that failed. Raw fetch and ArcGIS errors are in
// English and technical, so the common ones are put plainly.
export function describeUpstreamError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (name === "TimeoutError" || /timed? ?out/i.test(message)) return "šaltinis neatsakė laiku";
  const status = message.match(/HTTP(?: error)? (\d{3})/)?.[1];
  if (status) return `šaltinis grąžino klaidą (HTTP ${status})`;
  if (/fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|Unable to connect|socket/i.test(message)) {
    return "nepavyko prisijungti prie šaltinio";
  }
  if (/JSON|Unexpected token/i.test(message)) return "šaltinis grąžino netikėtą atsakymą";
  return message;
}
