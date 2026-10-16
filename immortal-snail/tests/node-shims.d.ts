/** The one Node API the tests use (the project has no @types/node: its code runs in browsers). */
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function readFileSync(path: string | URL): Uint8Array;
}
