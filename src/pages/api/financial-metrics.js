import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Fetch all ledger transactions
    const { data: ledgerData, error: ledgerError } = await supabaseAdmin
      .from("ledger")
      .select("*")
      .order("date", { ascending: true });

    if (ledgerError) {
      console.error("Ledger fetch error:", ledgerError);
      return res.status(500).json({ error: ledgerError.message });
    }

    // Fetch all members
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from("members")
      .select("*");

    if (membersError) {
      console.error("Members fetch error:", membersError);
      return res.status(500).json({ error: membersError.message });
    }

    // Helper function to check if transaction is in target month
    const isInTargetMonth = (dateStr) => {
      const d = new Date(dateStr);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    };

    // Calculate Monthly Recurring Revenue (MRR)
    const mrrBreakdown = membersData.reduce((acc, member) => {
      const dues = member.monthly_dues || 0;
      acc.total += dues;
      acc.breakdown.push({
        member_id: member.member_id,
        name: `${member.first_name} ${member.last_name}`,
        membership: member.membership,
        monthly_dues: dues
      });
      return acc;
    }, { total: 0, breakdown: [] });

    // Get current month dates for Toast API
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // Toast revenue feature removed - was causing 401 errors
    const toastRevenue = 0;
    const toastRevenueBreakdown = [];

    // Calculate July Payments Received (Membership dues only)
    const julyMembershipPayments = ledgerData.filter(tx =>
      tx.type === 'payment' && isInTargetMonth(tx.date) && tx.note?.toLowerCase().includes('dues')
    );
    const paymentsBreakdown = julyMembershipPayments.reduce((acc, tx) => {
      acc.total += Number(tx.amount);
      acc.breakdown.push({
        id: tx.id,
        date: tx.date,
        amount: Number(tx.amount),
        note: tx.note,
        member_id: tx.member_id
      });
      return acc;
    }, { total: 0, breakdown: [] });

    // Calculate July Revenue (Total revenue including dues and other purchases)
    const julyPurchases = ledgerData.filter(tx =>
      tx.type === 'purchase' && isInTargetMonth(tx.date)
    );
    const julyDuesPayments = ledgerData.filter(tx =>
      tx.type === 'payment' && isInTargetMonth(tx.date) && tx.note?.toLowerCase().includes('dues')
    );
    
    const purchasesBreakdown = julyPurchases.reduce((acc, tx) => {
      acc.total += Math.abs(Number(tx.amount)); // Convert negative to positive for display
      acc.breakdown.push({
        id: tx.id,
        date: tx.date,
        amount: Math.abs(Number(tx.amount)),
        note: tx.note,
        member_id: tx.member_id
      });
      return acc;
    }, { total: 0, breakdown: [] });

    const duesPaymentsBreakdown = julyDuesPayments.reduce((acc, tx) => {
      acc.total += Number(tx.amount);
      acc.breakdown.push({
        id: tx.id,
        date: tx.date,
        amount: Number(tx.amount),
        note: tx.note,
        member_id: tx.member_id
      });
      return acc;
    }, { total: 0, breakdown: [] });

    // Combine purchases and dues payments for total July Revenue
    const totalJulyRevenue = purchasesBreakdown.total + duesPaymentsBreakdown.total;
    const combinedRevenueBreakdown = [
      ...purchasesBreakdown.breakdown.map(item => ({ ...item, type: 'purchase' })),
      ...duesPaymentsBreakdown.breakdown.map(item => ({ ...item, type: 'dues_payment' }))
    ];

    // Calculate July A/R (Remaining membership dues owed)
    const julyAR = mrrBreakdown.total - paymentsBreakdown.total;

    // Helper function to calculate the due date for the current month
    const getCurrentMonthDueDate = (joinDate) => {
      if (!joinDate) return null;
      const jd = new Date(joinDate);
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // Current month (July = 6)
      const day = jd.getDate();
      return new Date(year, month, day);
    };

    // Get transactions still owed for July A/R (only for July dues)
    const julyARTransactions = [];
    
    // Get all members who owe dues
    membersData.forEach(member => {
      const monthlyDues = member.monthly_dues || 0;
      if (monthlyDues > 0) {
        // Check if they've paid their dues this month
        const duesPaid = paymentsBreakdown.breakdown
          .filter(payment => payment.member_id === member.member_id)
          .reduce((sum, payment) => sum + payment.amount, 0);
        
        // Only include if they still owe money (haven't paid or paid less than owed)
        if (duesPaid < monthlyDues) {
          const amountOwed = monthlyDues - duesPaid;
          
          // Calculate the due date for July
          const julyDueDate = getCurrentMonthDueDate(member.join_date);
          
          // Include if the due date is in July and is today or later
          if (julyDueDate && julyDueDate.getMonth() === 6) { // July = month 6
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to start of day
            const dueDateStart = new Date(julyDueDate);
            dueDateStart.setHours(0, 0, 0, 0);
            
            if (dueDateStart >= today) {
              julyARTransactions.push({
                id: `dues-${member.member_id}`,
                member_id: member.member_id,
                member_name: `${member.first_name} ${member.last_name}`,
                amount: amountOwed,
                note: 'Monthly Dues',
                date: julyDueDate.toISOString().split('T')[0],
                type: 'dues_owed'
              });
            }
          }
        }
      }
    });

    // Sort by due date (earliest first), then by amount owed (highest first)
    julyARTransactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return b.amount - a.amount;
    });

    // Calculate total from the actual transactions
    const totalJulyAR = julyARTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    // Calculate Outstanding Balances (all time)
    const accountBalances = {};
    ledgerData.forEach(tx => {
      if (!accountBalances[tx.account_id]) {
        accountBalances[tx.account_id] = {
          account_id: tx.account_id,
          member_id: tx.member_id,
          balance: 0,
          transactions: []
        };
      }
      accountBalances[tx.account_id].balance += Number(tx.amount);
      accountBalances[tx.account_id].transactions.push({
        id: tx.id,
        date: tx.date,
        type: tx.type,
        amount: Number(tx.amount),
        note: tx.note
      });
    });

    const outstandingBreakdown = Object.values(accountBalances)
      .filter(acc => acc.balance < 0) // Only accounts with negative balance (owed to us)
      .map(acc => ({
        account_id: acc.account_id,
        member_id: acc.member_id,
        balance: Math.abs(acc.balance), // Convert to positive for display
        amount: Math.abs(acc.balance), // Add amount field for component display
        transactions: acc.transactions
      }))
      .sort((a, b) => b.balance - a.balance);

    const totalOutstanding = outstandingBreakdown.reduce((sum, acc) => sum + acc.balance, 0);

    // Get member names for breakdowns
    const memberMap = {};
    membersData.forEach(member => {
      memberMap[member.member_id] = member;
    });

    // Add member names to breakdowns
    paymentsBreakdown.breakdown.forEach(payment => {
      const member = memberMap[payment.member_id];
      payment.member_name = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
    });

    purchasesBreakdown.breakdown.forEach(purchase => {
      const member = memberMap[purchase.member_id];
      purchase.member_name = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
    });

    outstandingBreakdown.forEach(account => {
      const member = memberMap[account.member_id];
      account.member_name = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
    });

    // Add member names to combined revenue breakdown
    combinedRevenueBreakdown.forEach(item => {
      const member = memberMap[item.member_id];
      item.member_name = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
    });

    // Sort July Revenue breakdown by date (earliest first)
    combinedRevenueBreakdown.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    // July Payments Received (Toast Revenue)
    const julyPaymentsReceived = {
      total: toastRevenue,
      description: "Total revenue from Toast POS system for the current month (from real-time webhook transactions)",
      breakdown: toastRevenueBreakdown
    };

    return res.status(200).json({
      monthlyRecurringRevenue: {
        total: mrrBreakdown.total,
        breakdown: mrrBreakdown.breakdown,
        description: "Sum of all active members' monthly dues - represents predictable monthly income from membership fees"
      },
      julyPaymentsReceived: julyPaymentsReceived,
      julyRevenue: {
        total: totalJulyRevenue,
        breakdown: combinedRevenueBreakdown,
        description: "Total member revenue in the current month - includes membership dues and all other purchases by members"
      },
      julyAR: {
        total: totalJulyAR,
        breakdown: julyARTransactions,
        description: "Remaining membership dues owed to us this month - Monthly Dues minus Dues Paid"
      },
      outstandingBalances: {
        total: totalOutstanding,
        breakdown: outstandingBreakdown,
        description: "Total amount owed by all members with negative account balances - represents outstanding debt across all accounts"
      },
      month: targetMonth,
      year: targetYear
    });

  } catch (error) {
    console.error("Financial metrics error:", error);
    return res.status(500).json({ error: error.message });
  }
} 