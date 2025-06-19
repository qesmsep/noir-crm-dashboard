

import sendHandler from '../../sendRenewalReminders';

export async function GET(req) {
  // Create a minimal response object for the handler
  const res = {
    status: () => ({ json: () => {} })
  };
  await sendHandler(req, res);
  return new Response('OK');
}