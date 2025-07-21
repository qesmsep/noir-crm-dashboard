import { NextApiRequest, NextApiResponse } from 'next';
import { 
  findMemberByPhone, 
  createLedgerEntry, 
  storeToastTransaction, 
  sendErrorNotification,
  updateSyncStatus,
  ToastAPI,
  ToastWebhookPayload
} from '../../lib/toast-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Toast webhook received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  try {
    // Start sync status tracking
    await updateSyncStatus({
      sync_type: 'webhook',
      status: 'in_progress'
    });

    const payload = req.body as ToastWebhookPayload;
    
    // Verify webhook signature if needed
    const toastAPI = new ToastAPI({
      apiKey: process.env.TOAST_API_KEY || '',
      baseUrl: process.env.TOAST_BASE_URL || '',
      locationId: process.env.TOAST_LOCATION || ''
    });

    // For now, we'll skip signature verification until we know Toast's exact method
    // const signature = req.headers['x-toast-signature'] as string;
    // const isValid = await toastAPI.verifyWebhookSignature(JSON.stringify(payload), signature);
    // if (!isValid) {
    //   await sendErrorNotification('Invalid webhook signature');
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Only process house account transactions
    if (payload.eventType !== 'transaction.completed') {
      console.log('Ignoring non-transaction event:', payload.eventType);
      await updateSyncStatus({
        sync_type: 'webhook',
        status: 'success',
        records_processed: 0
      });
      return res.status(200).json({ message: 'Event type not handled' });
    }

    const { transaction, customer } = payload;
    
    // Find member by phone number
    const member = await findMemberByPhone(customer.phone);
    if (!member) {
      const errorMsg = `No member found for phone: ${customer.phone}`;
      console.log(errorMsg);
      await sendErrorNotification(errorMsg);
      await updateSyncStatus({
        sync_type: 'webhook',
        status: 'failed',
        records_failed: 1,
        error_message: errorMsg
      });
      return res.status(200).json({ message: 'No member found' });
    }

    console.log('Processing Toast transaction for member:', {
      member_id: member.member_id,
      name: `${member.first_name} ${member.last_name}`,
      phone: member.phone,
      transaction_id: transaction.id,
      amount: transaction.amount
    });

    // Create ledger entry (negative amount for purchases)
    await createLedgerEntry({
      member_id: member.member_id,
      account_id: member.account_id,
      type: 'purchase',
      amount: -transaction.amount, // Negative for purchases
      note: `Toast purchase: ${transaction.items?.map((item: any) => item.name || item.description).join(', ') || 'House account purchase'}`,
      date: transaction.transactionDate
    });

    // Store Toast transaction record
    await storeToastTransaction({
      member_id: member.member_id,
      account_id: member.account_id,
      toast_transaction_id: transaction.id,
      toast_order_id: transaction.orderId,
      amount: transaction.amount,
      transaction_date: transaction.transactionDate,
      items: transaction.items,
      payment_method: transaction.paymentMethod,
      server_name: transaction.serverName,
      table_number: transaction.tableNumber
    });

    console.log('Successfully processed Toast transaction:', transaction.id);

    // Update sync status
    await updateSyncStatus({
      sync_type: 'webhook',
      status: 'success',
      records_processed: 1,
      completed_at: new Date().toISOString()
    });

    return res.status(200).json({ 
      success: true,
      message: 'Transaction processed successfully',
      member_id: member.member_id,
      transaction_id: transaction.id
    });

  } catch (error) {
    console.error('Error processing Toast webhook:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await sendErrorNotification(`Toast webhook error: ${errorMessage}`);
    
    await updateSyncStatus({
      sync_type: 'webhook',
      status: 'failed',
      records_failed: 1,
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    });

    return res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage
    });
  }
} 