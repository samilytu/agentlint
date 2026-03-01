import util from "node:util";

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function redirectLogsToStderr(): void {
  console.log = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
  console.info = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
}

export function writeStdout(content: string): void {
  process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

export function writeStderr(content: string): void {
  process.stderr.write(content.endsWith("\n") ? content : `${content}\n`);
}
