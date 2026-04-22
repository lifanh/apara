type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ...fields,
    ts: new Date().toISOString(),
    level,
    msg,
  };
  console.log(JSON.stringify(entry));
}

export function info(msg: string, fields?: Record<string, unknown>): void {
  log("info", msg, fields);
}

export function warn(msg: string, fields?: Record<string, unknown>): void {
  log("warn", msg, fields);
}

export function error(msg: string, fields?: Record<string, unknown>): void {
  log("error", msg, fields);
}
