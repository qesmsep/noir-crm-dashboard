declare module 'buffer' {
  export class Buffer {}
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}