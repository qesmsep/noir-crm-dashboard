/* eslint-disable @typescript-eslint/no-empty-interface */

import type {
  NextApiRequest as BaseNextApiRequest,
  NextApiResponse as BaseNextApiResponse
} from 'next';
import type { IncomingHttpHeaders } from 'http';
import type { ParsedUrlQuery } from 'querystring';

// Augment Next.js API types so we can add custom fields later if needed.
declare module 'next' {
  /**
   * Mirrors `BaseNextApiRequest` but explicit to keep strict linters happy
   */
  interface NextApiRequest extends BaseNextApiRequest {
    method: string | undefined;
    headers: IncomingHttpHeaders;
    query: ParsedUrlQuery;
    cookies: { [key: string]: string };
    body: unknown;
  }

  /**
   * Mirrors `BaseNextApiResponse` while keeping full helper chainable API.
   */
  interface NextApiResponse<T = any> extends BaseNextApiResponse<T> {
    status(code: number): NextApiResponse<T>;
    json(data: T): NextApiResponse<T>;
    setHeader(name: string, value: string | readonly string[]): this;
  }
}