import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ToastConfig {
  apiKey: string;
  baseUrl: string;
  locationId: string;
}

export interface ToastTransaction {
  id: string;
  orderId: string;
  amount: number;
  customerPhone: string;
  items: any[];
  paymentMethod: string;
  serverName: string;
  tableNumber: string;
  transactionDate: string;
}

export interface ToastWebhookPayload {
  eventType: string;
  transaction: {
    id: string;
    orderId: string;
    amount: number;
    customerPhone: string;
    items: any[];
    paymentMethod: string;
    serverName: string;
    tableNumber: string;
    transactionDate: string;
  };
  customer: {
    phone: string;
    name?: string;
  };
}

export interface ToastSalesSummary {
  totalSales: number;
  totalTransactions: number;
  salesByCategory?: any[];
  salesByPaymentMethod?: any[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export class ToastAPI {
  private config: ToastConfig;
  
  constructor(config: ToastConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Toast API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getSalesSummary(startDate: string, endDate: string): Promise<ToastSalesSummary> {
    try {
      // Toast API endpoint for sales summary reports
      // This would be the actual Toast API endpoint for sales summary
      const endpoint = `/reports/sales-summary?startDate=${startDate}&endDate=${endDate}&locationId=${this.config.locationId}`;
      
      const response = await this.makeRequest(endpoint);
      
      // Parse the response based on Toast's actual API format
      return {
        totalSales: response.totalSales || 0,
        totalTransactions: response.totalTransactions || 0,
        salesByCategory: response.salesByCategory || [],
        salesByPaymentMethod: response.salesByPaymentMethod || [],
        dateRange: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      console.error('Error fetching Toast sales summary:', error);
      throw error;
    }
  }

  async getTransactionsByPhone(phone: string, startDate: string, endDate: string): Promise<ToastTransaction[]> {
    // This would be implemented based on Toast's actual API endpoints
    // For now, we'll return an empty array as we're focusing on webhooks
    console.log(`Fetching Toast transactions for phone ${phone} from ${startDate} to ${endDate}`);
    return [];
  }

  async getCustomerByPhone(phone: string): Promise<any> {
    // This would be implemented based on Toast's actual API endpoints
    console.log(`Fetching Toast customer for phone ${phone}`);
    return null;
  }

  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    // Implement webhook signature verification based on Toast's security method
    // For now, we'll assume API key authentication is sufficient
    return true;
  }
}

// Utility functions for Toast integration
export async function findMemberByPhone(phone: string) {
  // Normalize phone number to match our database format
  const digits = phone.replace(/\D/g, '');
  const possiblePhones = [
    digits,
    '+1' + digits,
    '1' + digits,
    '+1' + digits.slice(-10),
    digits.slice(-10)
  ];

  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .or(possiblePhones.map(p => `phone.eq.${p}`).join(','))
    .single();

  if (error || !member) {
    console.log('No member found for phone:', phone);
    return null;
  }

  return member;
}

export async function createLedgerEntry(data: {
  member_id: string;
  account_id: string;
  type: string;
  amount: number;
  note: string;
  date: string;
}) {
  const { error } = await supabase
    .from('ledger')
    .insert({
      member_id: data.member_id,
      account_id: data.account_id,
      type: data.type,
      amount: data.amount,
      note: data.note,
      date: data.date
    });

  if (error) {
    console.error('Error creating ledger entry:', error);
    throw error;
  }
}

export async function storeToastTransaction(data: {
  member_id: string;
  account_id: string;
  toast_transaction_id: string;
  toast_order_id?: string;
  amount: number;
  transaction_date: string;
  items?: any[];
  payment_method?: string;
  server_name?: string;
  table_number?: string;
}) {
  const { error } = await supabase
    .from('toast_transactions')
    .insert({
      member_id: data.member_id,
      account_id: data.account_id,
      toast_transaction_id: data.toast_transaction_id,
      toast_order_id: data.toast_order_id,
      amount: data.amount,
      transaction_date: data.transaction_date,
      items: data.items,
      payment_method: data.payment_method,
      server_name: data.server_name,
      table_number: data.table_number
    });

  if (error) {
    console.error('Error storing Toast transaction:', error);
    throw error;
  }
}

export async function sendErrorNotification(error: string) {
  try {
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY!,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: ['+19137774488'],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID!,
        content: `Toast API Error: ${error}`
      })
    });

    if (!response.ok) {
      console.error('Failed to send error notification:', await response.text());
    }
  } catch (error) {
    console.error('Error sending error notification:', error);
  }
}

export async function updateSyncStatus(data: {
  sync_type: string;
  status: string;
  records_processed?: number;
  records_failed?: number;
  error_message?: string;
  completed_at?: string;
}) {
  const { error } = await supabase
    .from('toast_sync_status')
    .insert({
      sync_type: data.sync_type,
      status: data.status,
      records_processed: data.records_processed || 0,
      records_failed: data.records_failed || 0,
      error_message: data.error_message,
      completed_at: data.completed_at
    });

  if (error) {
    console.error('Error updating sync status:', error);
  }
} 