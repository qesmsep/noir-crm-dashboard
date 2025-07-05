/* eslint-disable @typescript-eslint/no-empty-interface */

import type {
  NextApiRequest as OriginalNextApiRequest,
  NextApiResponse as OriginalNextApiResponse
} from 'next';

// Augment Next.js API types so we can add custom fields later if needed.
declare module 'next' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface NextApiRequest extends OriginalNextApiRequest {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface NextApiResponse<T = any> extends OriginalNextApiResponse<T> {}
}