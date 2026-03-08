import util from "node:util";

export function redirectLogsToStderr(): void {
  console.log = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
  console.info = (...args: unknown[]): void => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
}
