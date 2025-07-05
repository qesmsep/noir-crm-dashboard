declare module 'next' {
  // Re-export commonly used API types from Next.js
  import { IncomingMessage, ServerResponse } from 'http';
  export interface NextApiRequest extends IncomingMessage {
    body: any;
    query: {
      [key: string]: string | string[];
    };
    cookies: {
      [key: string]: string;
    };
  }
  export interface NextApiResponse<T = any> extends ServerResponse {
    status(code: number): NextApiResponse<T>;
    json(data: T): void;
    end(data?: string): void;
    setHeader(key: string, value: string | string[]): void;
  }
}