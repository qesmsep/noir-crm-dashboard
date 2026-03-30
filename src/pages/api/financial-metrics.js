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

    // Fetch all ledger transactions (paginated to avoid 1000-row limit)
    const ledgerData = [];
    let ledgerFrom = 0;
    const pageSize = 1000;
    let hasMoreLedger = true;

    while (hasMoreLedger) {
      const { data, error } = await supabaseAdmin
        .from("ledger")
        .select("*")
        .order("date", { ascending: true })
        .range(ledgerFrom, ledgerFrom + pageSize - 1);

      if (error) {
        console.error("Ledger fetch error:", error);
        return res.status(500).json({ error: error.message });
      }

      if (data && data.length > 0) {
        ledgerData.push(...data);
        ledgerFrom += pageSize;
        hasMoreLedger = data.length === pageSize;
      } else {
        hasMoreLedger = false;
      }
    }

    // Fetch all members (paginated to avoid 1000-row limit)
    const membersData = [];
    let membersFrom = 0;
    let hasMoreMembers = true;

    while (hasMoreMembers) {
      const { data, error } = await supabaseAdmin
        .from("members")
        .select("*")
        .range(membersFrom, membersFrom + pageSize - 1);

      if (error) {
        console.error("Members fetch error:", error);
        return res.status(500).json({ error: error.message });
      }

      if (data && data.length > 0) {
        membersData.push(...data);
        membersFrom += pageSize;
        hasMoreMembers = data.length === pageSize;
      } else {
        hasMoreMembers = false;
      }
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

    // Calculate Past Due Balances (outstanding balances where due date has passed)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for comparison

    const pastDueBreakdown = Object.values(accountBalances)
      .filter(acc => {
        if (acc.balance >= 0) return false; // Only negative balances (owed to us)

        // Find the member to get their join_date
        const member = membersData.find(m => m.member_id === acc.member_id);
        if (!member || !member.join_date) return false;

        // Calculate their most recent due date
        const joinDate = new Date(member.join_date);
        const currentMonthDueDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate());

        // If current month's due date hasn't passed yet, check last month
        let dueDate = currentMonthDueDate;
        if (currentMonthDueDate > today) {
          dueDate = new Date(today.getFullYear(), today.getMonth() - 1, joinDate.getDate());
        }

        // Include if due date has passed
        return dueDate < today;
      })
      .map(acc => ({
        account_id: acc.account_id,
        member_id: acc.member_id,
        balance: Math.abs(acc.balance),
        amount: Math.abs(acc.balance),
        transactions: acc.transactions
      }))
      .sort((a, b) => b.balance - a.balance);

    const totalPastDue = pastDueBreakdown.reduce((sum, acc) => sum + acc.balance, 0);

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

    pastDueBreakdown.forEach(account => {
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

    // Calculate YTD (Year-to-Date) Total Revenue
    const ytdRevenue = ledgerData
      .filter(tx => tx.type === 'payment' && new Date(tx.date).getFullYear() === targetYear)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Calculate Last Year Total Revenue
    const lastYearRevenue = ledgerData
      .filter(tx => tx.type === 'payment' && new Date(tx.date).getFullYear() === (targetYear - 1))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Calculate Average Monthly Revenue (last 3 FULL months, including all member payments)
    const now12Months = new Date();
    // Start from the beginning of the current month, then go back 3 months
    const startOfCurrentMonth = new Date(now12Months.getFullYear(), now12Months.getMonth(), 1);
    const startOfLast3Months = new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth() - 3, 1);
    const endOfLast3Months = new Date(startOfCurrentMonth.getTime() - 1); // Last millisecond before current month

    // Group payments by month for the last 3 full months
    const monthlyRevenues = {};
    let monthsWithRevenue = 0;

    ledgerData
      .filter(tx => {
        if (tx.type !== 'payment') return false;
        const txDate = new Date(tx.date);
        return txDate >= startOfLast3Months && txDate <= endOfLast3Months;
      })
      .forEach(tx => {
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;
        if (!monthlyRevenues[monthKey]) {
          monthlyRevenues[monthKey] = 0;
          monthsWithRevenue++;
        }
        monthlyRevenues[monthKey] += Number(tx.amount) || 0;
      });

    const totalLast3Months = Object.values(monthlyRevenues).reduce((sum, amt) => sum + amt, 0);
    // Always divide by 3 for last 3 full months, even if some months had zero revenue
    const averageMonthlyRevenue = totalLast3Months / 3;

    // Calculate monthly revenue breakdown for last 12 months (for charting)
    const startOfLast12Months = new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth() - 12, 1);
    const monthlyRevenueBreakdown = [];

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth() - i - 1, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      const monthRevenue = ledgerData
        .filter(tx => {
          if (tx.type !== 'payment') return false;
          const txDate = new Date(tx.date);
          return txDate >= monthStart && txDate <= monthEnd;
        })
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      monthlyRevenueBreakdown.push({
        month: monthKey,
        revenue: monthRevenue
      });
    }
    // Array is already in chronological order (oldest to newest)

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
      pastDueBalances: {
        total: totalPastDue,
        breakdown: pastDueBreakdown,
        description: "Total amount owed by members where payment due date has passed - past due balances requiring immediate attention"
      },
      ytdRevenue: {
        total: ytdRevenue,
        description: `Total revenue from payments received in ${targetYear} (Year-to-Date)`
      },
      lastYearRevenue: {
        total: lastYearRevenue,
        description: `Total revenue from payments received in ${targetYear - 1}`
      },
      averageMonthlyRevenue: {
        total: averageMonthlyRevenue,
        description: `Average monthly total revenue (all member payments) over the last 3 full months`,
        monthsWithRevenue: 3,
        totalLast3Months: totalLast3Months,
        monthlyBreakdown: monthlyRevenueBreakdown
      },
      month: targetMonth,
      year: targetYear
    });

  } catch (error) {
    console.error("Financial metrics error:", error);
    return res.status(500).json({ error: error.message });
  }
} 