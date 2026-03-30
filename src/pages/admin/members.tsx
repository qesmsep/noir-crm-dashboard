import { useEffect, useState } from "react";
import React from "react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/useToast";
import { useRouter } from "next/router";
import Image from "next/image";
import { getSupabaseClient } from "../api/supabaseClient";
import AdminLayout from '../../components/layouts/AdminLayout';
import AddMemberModal from '../../components/members/AddMemberModal';
import ArchivedMembersModal from '../../components/ArchivedMembersModal';
import PendingMembersModal from '../../components/PendingMembersModal';
import styles from '../../styles/Members.module.css';

interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  join_date?: string;
  member_type?: string;
  dob?: string;
  status?: string;
  accounts?: {
    subscription_cancel_at?: string | null;
    subscription_status?: string | null;
    next_billing_date?: string | null;
    plan_name?: string | null;
  };
}

type SortField = 'name' | 'join_date' | 'renewal_date' | 'mrr' | 'ltv' | 'balance' | null;
type SortDirection = 'asc' | 'desc';

export default function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
  const [accountLTVs, setAccountLTVs] = useState<Record<string, number>>({});
  const [accountMRRs, setAccountMRRs] = useState<Record<string, number>>({});
  const [failedPaymentAccounts, setFailedPaymentAccounts] = useState<Set<string>>(new Set());
  const [noSubscriptionAccounts, setNoSubscriptionAccounts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('membersSortField');
      return (saved === 'name' || saved === 'join_date' || saved === 'renewal_date' || saved === 'mrr' || saved === 'ltv' || saved === 'balance') ? saved : null;
    }
    return null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('membersSortDirection');
      return (saved === 'asc' || saved === 'desc') ? saved : 'desc';
    }
    return 'desc';
  });
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);
  const [bulkMessageContent, setBulkMessageContent] = useState('');
  const [sendingBulkMessage, setSendingBulkMessage] = useState(false);
  const [bulkMessageResults, setBulkMessageResults] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active'); // Default to active only
  const [planFilter, setPlanFilter] = useState<string>('all');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
    fetchAccountBalances();
    fetchFailedPayments();
    fetchNoSubscriptionAccounts();
  }, []);

  async function fetchFailedPayments() {
    try {
      const res = await fetch('/api/accounts/failed-payments-summary');
      const result = await res.json();
      if (!result.error && result.failed_payment_accounts) {
        const failedSet = new Set<string>(result.failed_payment_accounts.map((fp: any) => fp.account_id as string));
        setFailedPaymentAccounts(failedSet);
      }
    } catch (err: any) {
      console.error('Error fetching failed payments:', err);
    }
  }

  async function fetchNoSubscriptionAccounts() {
    try {
      const res = await fetch('/api/accounts/no-subscription-summary');
      const result = await res.json();
      if (!result.error && result.no_subscription_accounts) {
        const noSubSet = new Set<string>(result.no_subscription_accounts.map((acc: any) => acc.account_id as string));
        setNoSubscriptionAccounts(noSubSet);
      }
    } catch (err: any) {
      console.error('Error fetching no subscription accounts:', err);
    }
  }

  // Helper to check if account is cancelled
  const isAccountCancelled = (account: { accounts?: { subscription_cancel_at?: string | null; subscription_status?: string | null } }) => {
    return account.accounts?.subscription_status === 'canceled' || !!account.accounts?.subscription_cancel_at;
  };

  // Initialize selected members when modal opens
  useEffect(() => {
    if (isBulkMessageModalOpen && selectAll) {
      const allMemberIds = new Set(
        sortedAccounts
          .filter(account => !isAccountCancelled(account)) // Exclude cancelled memberships
          .flatMap(account => account.allMembers.map(m => m.member_id))
      );
      setSelectedMemberIds(allMemberIds);
    }
  }, [isBulkMessageModalOpen, selectAll]);

  async function fetchMembers() {
    try {
      const supabase = getSupabaseClient();

      // Fetch members (active, paused, and inactive/archived)
      const { data: membersData, error: membersError} = await supabase
        .from('members')
        .select('*')
        .in('status', ['active', 'paused', 'inactive']); // Include inactive (archived) for canceled filter

      if (membersError) throw membersError;

      // Fetch all unique account IDs
      const accountIds = [...new Set(membersData?.map(m => m.account_id) || [])];

      // Fetch account subscription data with plan name and MRR
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          account_id,
          subscription_cancel_at,
          subscription_status,
          next_billing_date,
          monthly_dues,
          subscription_plans!membership_plan_id (
            plan_name
          )
        `)
        .in('account_id', accountIds);

      if (accountsError) throw accountsError;

      // Map accounts data by account_id and flatten plan_name
      const accountsMap = new Map(
        accountsData?.map(acc => [
          acc.account_id,
          {
            account_id: acc.account_id,
            subscription_cancel_at: acc.subscription_cancel_at,
            subscription_status: acc.subscription_status,
            next_billing_date: acc.next_billing_date,
            plan_name: (acc as any).subscription_plans?.plan_name || null
          }
        ]) || []
      );

      // Store MRR values
      const mrrMap: Record<string, number> = {};
      accountsData?.forEach(acc => {
        mrrMap[acc.account_id] = Number(acc.monthly_dues) || 0;
      });
      setAccountMRRs(mrrMap);

      // Merge data
      const membersWithAccounts = membersData?.map(member => ({
        ...member,
        accounts: accountsMap.get(member.account_id)
      })) || [];

      setMembers(membersWithAccounts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fetch account balances and LTV from server - single source of truth
  async function fetchAccountBalances() {
    try {
      const res = await fetch('/api/ledger?account_balances=1');
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setAccountBalances(result.balances || {});
      setAccountLTVs(result.ltvs || {});
    } catch (err: any) {
      console.error('Error fetching account balances:', err);
    }
  }

  const formatDateLong = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length < 10) {
      cleaned = cleaned.padStart(10, '0');
    }
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateShort = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).replace(/\//g, '.');
  };

  // Account LTV, balance, and MRR from server-side calculation (single source of truth)
  const getAccountLTV = (accountId: string) => {
    return accountLTVs[accountId] || 0;
  };

  const getAccountBalance = (accountId: string) => {
    return accountBalances[accountId] || 0;
  };

  const getAccountMRR = (accountId: string) => {
    return accountMRRs[accountId] || 0;
  };

  // Get next billing date from accounts table (single source of truth)
  const getNextBillingDate = (member: Member): Date | null => {
    if (!member.accounts?.next_billing_date) return null;
    return new Date(member.accounts.next_billing_date);
  };

  const filteredMembers = members.filter(member => {
    const searchStr = lookupQuery.toLowerCase();
    return (
      member.first_name?.toLowerCase().includes(searchStr) ||
      member.last_name?.toLowerCase().includes(searchStr) ||
      member.email?.toLowerCase().includes(searchStr) ||
      member.phone?.includes(searchStr)
    );
  });

  // Group members by account_id and create account summary
  interface AccountSummary {
    account_id: string;
    primaryMember: Member;
    allMembers: Member[];
    mrr: number;
    ltv: number;
    balance: number;
    join_date?: string;
    renewal_date: Date | null;
    accounts?: {
      subscription_cancel_at?: string | null;
      subscription_status?: string | null;
      plan_name?: string | null;
    };
  }

  const accounts: AccountSummary[] = Object.entries(
    filteredMembers.reduce((acc, member) => {
      if (!acc[member.account_id]) acc[member.account_id] = [];
      acc[member.account_id].push(member);
      return acc;
    }, {} as { [accountId: string]: Member[] })
  ).map(([accountId, accountMembers]) => {
    const primary = accountMembers.find(m => m.member_type === 'primary') || accountMembers[0];
    return {
      account_id: accountId,
      primaryMember: primary,
      allMembers: accountMembers,
      mrr: getAccountMRR(accountId),
      ltv: getAccountLTV(accountId),
      balance: getAccountBalance(accountId),
      join_date: primary.join_date,
      renewal_date: getNextBillingDate(primary),
      accounts: primary.accounts, // Pass through subscription data
    };
  });

  // Apply filters
  const filteredAccounts = accounts.filter(account => {
    // Exclude accounts where all members are archived/inactive (unless filtering for canceled)
    const hasArchivedMembers = account.allMembers.some(m => m.status === 'inactive');
    const allMembersArchived = account.allMembers.every(m => m.status === 'inactive');

    // Filter by subscription status
    if (statusFilter !== 'all') {
      const status = account.accounts?.subscription_status;
      if (statusFilter === 'active' && status !== 'active') return false;
      if (statusFilter === 'canceled') {
        // Show canceled accounts OR accounts with archived members
        if (!isAccountCancelled(account) && !hasArchivedMembers) return false;
      }
      if (statusFilter === 'past_due' && status !== 'past_due') return false;
      if (statusFilter === 'paused' && status !== 'paused') return false;
    } else {
      // For "all" filter, exclude accounts where all members are archived
      if (allMembersArchived) return false;
    }

    // Exclude fully archived accounts from non-canceled filters
    if (statusFilter !== 'canceled' && allMembersArchived) return false;

    // Filter by membership plan
    if (planFilter !== 'all') {
      const planName = account.accounts?.plan_name;
      if (!planName || planName !== planFilter) return false;
    }

    return true;
  });

  // Get unique plan names for filter dropdown
  const uniquePlans = [...new Set(
    accounts
      .map(acc => acc.accounts?.plan_name)
      .filter(Boolean)
  )].sort() as string[];

  // Handle sorting
  const handleSort = (field: SortField) => {
    let newDirection: SortDirection;
    if (sortField === field) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      newDirection = 'asc';
    }
    
    setSortField(field);
    setSortDirection(newDirection);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('membersSortField', field || '');
      localStorage.setItem('membersSortDirection', newDirection);
    }
  };

  // Sort filtered accounts
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (!sortField) return 0;

    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = `${a.primaryMember.first_name} ${a.primaryMember.last_name}`.localeCompare(
          `${b.primaryMember.first_name} ${b.primaryMember.last_name}`
        );
        break;
      case 'join_date':
        const aJoin = a.join_date ? new Date(a.join_date).getTime() : 0;
        const bJoin = b.join_date ? new Date(b.join_date).getTime() : 0;
        comparison = aJoin - bJoin;
        break;
      case 'renewal_date':
        const aRenewal = a.renewal_date ? a.renewal_date.getTime() : 0;
        const bRenewal = b.renewal_date ? b.renewal_date.getTime() : 0;
        comparison = aRenewal - bRenewal;
        break;
      case 'mrr':
        comparison = a.mrr - b.mrr;
        break;
      case 'ltv':
        comparison = a.ltv - b.ltv;
        break;
      case 'balance':
        comparison = a.balance - b.balance;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Initialize selected members when modal opens
  useEffect(() => {
    if (isBulkMessageModalOpen && selectAll) {
      const allMemberIds = new Set(
        sortedAccounts
          .filter(account => !isAccountCancelled(account)) // Exclude cancelled memberships
          .flatMap(account => account.allMembers.map(m => m.member_id))
      );
      setSelectedMemberIds(allMemberIds);
    }
  }, [isBulkMessageModalOpen, selectAll]);

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedMemberIds(new Set());
      setSelectAll(false);
    } else {
      const allMemberIds = new Set(
        sortedAccounts
          .filter(account => !isAccountCancelled(account)) // Exclude cancelled memberships
          .flatMap(account => account.allMembers.map(m => m.member_id))
      );
      setSelectedMemberIds(allMemberIds);
      setSelectAll(true);
    }
  };

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMemberIds);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
      setSelectAll(false);
    } else {
      newSelected.add(memberId);
      // Check if all members are now selected
      const allMemberIds = sortedAccounts.flatMap(account => account.allMembers.map(m => m.member_id));
      if (newSelected.size === allMemberIds.length) {
        setSelectAll(true);
      }
    }
    setSelectedMemberIds(newSelected);
  };

  const handleDraftMessage = () => {
    if (!bulkMessageContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        status: "error",
        duration: 3000,
      });
      return;
    }

    if (selectedMemberIds.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one member",
        status: "error",
        duration: 3000,
      });
      return;
    }

    // Show preview
    setShowPreview(true);
  };

  const handleConfirmSend = async () => {
    setShowPreview(false);
    setSendingBulkMessage(true);
    try {
      // Get selected member account IDs
      const selectedAccountIds = new Set(
        sortedAccounts
          .filter(account => account.allMembers.some(m => selectedMemberIds.has(m.member_id)))
          .map(account => account.account_id)
      );

      const response = await fetch('/api/send-bulk-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: bulkMessageContent.trim(),
          member_ids: Array.from(selectedMemberIds),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send bulk message');
      }

      setBulkMessageResults(result);
      toast({
        title: "Messages Sent",
        description: `Sent to ${result.sent} members${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        status: "success",
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error sending bulk message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send bulk message",
        status: "error",
        duration: 5000,
      });
    } finally {
      setSendingBulkMessage(false);
    }
  };

  const handleSaveMember = async (memberData: any) => {
    setSaving(true);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create member');
      }

      await fetchMembers();

      toast({
        title: "Success",
        description: "Member created successfully",
        status: "success",
        duration: 3000,
      });

      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error('Error creating member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create member",
        status: "error",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>
          <Spinner size="xl" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <div className={styles.emptyState}>
            Error loading members: {error}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Header with Title, Search, and Buttons */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className={styles.pageTitle}>Members</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className={styles.memberCount}>
                {sortedAccounts.reduce((sum, acc) => sum + acc.allMembers.length, 0)} {statusFilter !== 'all' ? statusFilter : ''} members
                {(statusFilter !== 'all' || planFilter !== 'all') && (
                  <span style={{ color: '#6B7280', fontWeight: '400' }}> ({members.length} total)</span>
                )}
              </span>
              <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                {sortedAccounts.length} {statusFilter !== 'all' ? statusFilter : ''} accounts
              </span>
            </div>
          </div>
          <div className={styles.searchAndSortContainer}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
              />
            </div>
            {/* Status Filter */}
            <select
              className={styles.filterDropdown}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
              <option value="paused">Paused</option>
            </select>
            {/* Plan Filter */}
            <select
              className={styles.filterDropdown}
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              title="Filter by plan"
            >
              <option value="all">All Plans</option>
              {uniquePlans.map(plan => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
            {/* Sort dropdown for mobile */}
            <select
              className={styles.mobileSortDropdown}
              value={sortField || ''}
              onChange={(e) => handleSort(e.target.value as SortField)}
            >
              <option value="">Sort</option>
              <option value="name">Name</option>
              <option value="join_date">Sign Up</option>
              <option value="renewal_date">Renewal</option>
              <option value="mrr">MRR</option>
              <option value="ltv">LTV</option>
              <option value="balance">Balance</option>
            </select>
            {sortField && (
              <button
                className={styles.sortDirectionButton}
                onClick={() => {
                  const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                  setSortDirection(newDirection);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('membersSortDirection', newDirection);
                  }
                }}
                aria-label={`Sort direction: ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            )}
          </div>
          <div className={styles.headerButtons}>
            <button
              onClick={() => setIsBulkMessageModalOpen(true)}
              className={styles.iconButton}
              title="Send Message to All"
              aria-label="Send message to all members"
            >
              <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.buttonText}>Message</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              disabled={saving}
              className={styles.iconButton}
              title={saving ? 'Adding...' : 'Add Member'}
              aria-label="Add member"
            >
              <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.buttonText}>Add</span>
            </button>
            <button
              onClick={() => setIsArchivedModalOpen(true)}
              className={styles.iconButton}
              title="View Archived Members"
              aria-label="View archived members"
            >
              <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 8h10M5 8a2 2 0 110-4h10a2 2 0 110 4M5 8v10a2 2 0 002 2h6a2 2 0 002-2V8m-3 4h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.buttonText}>Archive</span>
            </button>
            <button
              onClick={() => setIsPendingModalOpen(true)}
              className={styles.iconButton}
              title="View Pending Members"
              aria-label="View pending members"
            >
              <svg className={styles.iconButtonIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 6v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className={styles.buttonText}>Pending</span>
            </button>
          </div>
        </div>

        {/* Members Table */}
        {sortedAccounts.length === 0 ? (
          <div className={styles.emptyState}>
            No members found
          </div>
        ) : (
          <>
            {/* Mobile Sort Controls */}
            <div className={styles.mobileSortControls}>
              <label className={styles.sortLabel}>Sort by:</label>
              <select
                className={styles.sortSelect}
                value={sortField || ''}
                onChange={(e) => handleSort(e.target.value as SortField)}
              >
                <option value="">None</option>
                <option value="name">Name</option>
                <option value="join_date">Sign Up Date</option>
                <option value="renewal_date">Renewal Date</option>
                <option value="mrr">MRR</option>
                <option value="ltv">LTV</option>
                <option value="balance">Balance</option>
              </select>
              {sortField && (
                <button
                  className={styles.sortDirectionButton}
                  onClick={() => {
                    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                    setSortDirection(newDirection);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('membersSortDirection', newDirection);
                    }
                  }}
                  aria-label={`Sort direction: ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                >
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </div>

            <div className={styles.mobileList}>
              {sortedAccounts.map((account) => {
                const sortedMembers = account.allMembers.sort((a, b) => {
                  if (a.member_type === 'primary' && b.member_type !== 'primary') return -1;
                  if (a.member_type !== 'primary' && b.member_type === 'primary') return 1;
                  return 0;
                });
                const member1 = sortedMembers[0];
                const member2 = sortedMembers[1] || null;

                return (
                  <div
                    key={account.account_id}
                    className={`${styles.mobileCard} ${noSubscriptionAccounts.has(account.account_id) ? styles.noSubscription : ''}`}
                    onClick={() => router.push(`/admin/members/${account.account_id}`)}
                  >
                    <div className={styles.mobileCardHeader}>
                      {failedPaymentAccounts.has(account.account_id) && (
                        <div className={styles.paymentFailedBanner}>
                          PAYMENT FAILED
                        </div>
                      )}
                      <div className={styles.mobileMemberRow}>
                        {member1?.photo ? (
                          <div className={styles.mobileAvatar}>
                            <Image
                              src={member1.photo}
                              alt={`${member1.first_name} ${member1.last_name}`}
                              width={96}
                              height={96}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className={styles.mobileAvatarPlaceholder}>
                            {member1?.first_name?.[0]}{member1?.last_name?.[0]}
                          </div>
                        )}
                        <div className={styles.mobileMemberInfo}>
                          <div className={styles.mobileMemberName}>
                            {member1?.first_name} {member1?.last_name}
                            {member1?.member_type === 'primary' && (
                              <span className={styles.mobilePrimaryBadge}>Primary</span>
                            )}
                          </div>
                          <div className={styles.mobileContactLine}>
                            {member1?.email || '—'}
                          </div>
                          <div className={styles.mobileContactLine}>
                            {member1?.phone ? formatPhone(member1.phone) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {member2 && (
                      <div className={styles.mobileSecondaryRow}>
                        {member2.photo ? (
                          <div className={styles.mobileAvatarSmall}>
                            <Image
                              src={member2.photo}
                              alt={`${member2.first_name} ${member2.last_name}`}
                              width={36}
                              height={36}
                              style={{ width: 'auto', height: 'auto', objectFit: 'cover', borderRadius: '8px' }}
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className={styles.mobileAvatarSmallPlaceholder}>
                            {member2.first_name?.[0]}{member2.last_name?.[0]}
                          </div>
                        )}
                        <div className={styles.mobileSecondaryInfo}>
                          <div className={styles.mobileSecondaryName}>
                            {member2.first_name} {member2.last_name}
                          </div>
                          <div className={styles.mobileSecondaryMeta}>
                            {member2.email || member2.phone ? (
                              <>
                                {member2.email && <span>{member2.email}</span>}
                                {member2.phone && <span>{formatPhone(member2.phone)}</span>}
                              </>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={styles.mobileMetaRow}>
                      <div className={styles.mobileMetaItem}>
                        <span className={styles.mobileMetaLabel}>Sign Up</span>
                        <span className={styles.mobileMetaValue}>{formatDateShort(account.join_date)}</span>
                      </div>
                      <div className={styles.mobileMetaItem}>
                        <span className={styles.mobileMetaLabel}>Renewal</span>
                        <span className={styles.mobileMetaValue}>
                          {account.renewal_date ? formatDateShort(account.renewal_date.toISOString()) : 'N/A'}
                        </span>
                      </div>
                      <div className={styles.mobileMetaItem}>
                        <span className={styles.mobileMetaLabel}>MRR</span>
                        <span className={styles.mobileMetaValue}>{formatCurrency(account.mrr)}</span>
                      </div>
                      <div className={styles.mobileMetaItem}>
                        <span className={styles.mobileMetaLabel}>LTV</span>
                        <span className={styles.mobileMetaValue}>{formatCurrency(account.ltv)}</span>
                      </div>
                      <div className={styles.mobileMetaItem}>
                        <span className={styles.mobileMetaLabel}>Balance</span>
                        <span className={`${styles.mobileMetaValue} ${account.balance < 0 ? styles.negative : account.balance > 0 ? styles.positive : ''}`}>
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.membersTable}>
              <thead>
                <tr>
                  <th 
                    className={`${styles.sortableHeader} ${styles.nameColumnHeader} ${sortField === 'name' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('name')}
                  >
                    Member 1
                    {sortField === 'name' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th className={`${styles.headerCell} ${styles.nameColumnHeader}`}>Member 2</th>
                  <th 
                    className={`${styles.sortableHeader} ${styles.thinColumn} ${sortField === 'join_date' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('join_date')}
                  >
                    Sign Up
                    {sortField === 'join_date' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    className={`${styles.sortableHeader} ${styles.thinColumn} ${sortField === 'renewal_date' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('renewal_date')}
                  >
                    Renewal
                    {sortField === 'renewal_date' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    className={`${styles.sortableHeader} ${styles.thinColumn} ${sortField === 'mrr' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('mrr')}
                  >
                    MRR
                    {sortField === 'mrr' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    className={`${styles.sortableHeader} ${styles.thinColumn} ${sortField === 'ltv' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('ltv')}
                  >
                    LTV
                    {sortField === 'ltv' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th
                    className={`${styles.sortableHeader} ${styles.thinColumn} ${sortField === 'balance' ? styles.activeSort : ''}`}
                    onClick={() => handleSort('balance')}
                  >
                    Balance
                    {sortField === 'balance' && (
                      <span className={styles.sortIndicator}>
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => {
                  const sortedMembers = account.allMembers.sort((a, b) => {
                    if (a.member_type === 'primary' && b.member_type !== 'primary') return -1;
                    if (a.member_type !== 'primary' && b.member_type === 'primary') return 1;
                    return 0;
                  });
                  const member1 = sortedMembers[0];
                  const member2 = sortedMembers[1] || null;
                  
                  return (
                    <tr
                      key={account.account_id}
                      className={`${styles.tableRow} ${noSubscriptionAccounts.has(account.account_id) ? styles.noSubscription : ''}`}
                      onClick={() => router.push(`/admin/members/${account.account_id}`)}
                    >
                      {/* Member 1 Column */}
                      <td className={styles.nameCell}>
                        {member1 && (
                          <div className={styles.nameWrapper}>
                            {member1.photo ? (
                              <div className={styles.avatar}>
                                <Image
                                  src={member1.photo}
                                  alt={`${member1.first_name} ${member1.last_name}`}
                                  width={64}
                                  height={64}
                                  style={{
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'cover',
                                    objectPosition: 'center',
                                    borderRadius: '8px'
                                  }}
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className={styles.avatarPlaceholder}>
                                {member1.first_name?.[0]}{member1.last_name?.[0]}
                              </div>
                            )}
                            <div className={styles.memberInfo}>
                              <div className={styles.primaryName}>
                                {member1.first_name} {member1.last_name}
                                {member1.member_type === 'primary' && (
                                  <span className={styles.primaryBadge}>Primary</span>
                                )}
                              </div>
                              <div className={styles.contactInfo}>
                                {member1.email && (
                                  <div className={styles.contactLine}>{member1.email}</div>
                                )}
                                {member1.phone && (
                                  <div className={styles.contactLine}>{formatPhone(member1.phone)}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      
                      {/* Member 2 Column */}
                      <td className={styles.nameCell}>
                        {member2 ? (
                          <div className={styles.nameWrapper}>
                            {member2.photo ? (
                              <div className={styles.avatar}>
                                <Image
                                  src={member2.photo}
                                  alt={`${member2.first_name} ${member2.last_name}`}
                                  width={64}
                                  height={64}
                                  style={{
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'cover',
                                    objectPosition: 'center',
                                    borderRadius: '8px'
                                  }}
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className={styles.avatarPlaceholder}>
                                {member2.first_name?.[0]}{member2.last_name?.[0]}
                              </div>
                            )}
                            <div className={styles.memberInfo}>
                              <div className={styles.primaryName}>
                                {member2.first_name} {member2.last_name}
                                {member2.member_type === 'primary' && (
                                  <span className={styles.primaryBadge}>Primary</span>
                                )}
                              </div>
                              <div className={styles.contactInfo}>
                                {member2.email && (
                                  <div className={styles.contactLine}>{member2.email}</div>
                                )}
                                {member2.phone && (
                                  <div className={styles.contactLine}>{formatPhone(member2.phone)}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.emptyMemberCell}>—</div>
                        )}
                      </td>
                      
                      <td className={`${styles.dateCell} ${styles.thinCell}`}>
                        {formatDateShort(account.join_date)}
                      </td>
                      <td className={`${styles.dateCell} ${styles.thinCell}`}>
                        {account.renewal_date ? formatDateShort(account.renewal_date.toISOString()) : 'N/A'}
                      </td>
                      <td className={`${styles.ltvCell} ${styles.thinCell}`}>
                        {formatCurrency(account.mrr)}
                      </td>
                      <td className={`${styles.ltvCell} ${styles.thinCell}`}>
                        {formatCurrency(account.ltv)}
                      </td>
                      <td className={`${styles.ltvCell} ${styles.thinCell} ${account.balance < 0 ? styles.negative : account.balance > 0 ? styles.positive : ''}`}>
                        {formatCurrency(account.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMember}
      />

      <ArchivedMembersModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
        onUnarchiveSuccess={() => {
          // Refresh the members list when a member is unarchived
          fetchMembers();
        }}
      />

      <PendingMembersModal
        isOpen={isPendingModalOpen}
        onClose={() => setIsPendingModalOpen(false)}
        onStatusChangeSuccess={() => {
          // Refresh the members list when a pending member status changes
          fetchMembers();
        }}
      />

      {/* Bulk Message Modal */}
      {isBulkMessageModalOpen && (
        <div className={styles.modalOverlay} onClick={() => !sendingBulkMessage && setIsBulkMessageModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Send Message to All Members</h2>
              {!sendingBulkMessage && (
                <button
                  className={styles.modalCloseButton}
                  onClick={() => {
                    setIsBulkMessageModalOpen(false);
                    setBulkMessageContent('');
                    setBulkMessageResults(null);
                    setSelectedMemberIds(new Set());
                    setSelectAll(true);
                    setShowPreview(false);
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {!bulkMessageResults ? (
              <>
                {!showPreview ? (
                  <>
                    <div className={styles.modalBody}>
                      <p className={styles.modalDescription}>
                        Select members and draft your message
                      </p>
                      
                      {/* Member Selection */}
                      <div className={styles.memberSelection}>
                        <div className={styles.selectAllRow}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleToggleSelectAll}
                              className={styles.checkbox}
                            />
                            <span className={styles.checkboxText}>
                              Select All Active ({sortedAccounts.filter(acc => !isAccountCancelled(acc)).reduce((sum, acc) => sum + acc.allMembers.length, 0)} members)
                            </span>
                          </label>
                        </div>
                        <div className={styles.memberList}>
                          {sortedAccounts.map((account) => (
                            <div key={account.account_id} className={styles.accountGroup}>
                              {account.allMembers.map((member) => (
                                <label key={member.member_id} className={styles.memberCheckbox}>
                                  <input
                                    type="checkbox"
                                    checked={selectedMemberIds.has(member.member_id)}
                                    onChange={() => handleToggleMember(member.member_id)}
                                    className={styles.checkbox}
                                  />
                                  <span className={styles.memberCheckboxText}>
                                    {member.first_name} {member.last_name}
                                    {member.member_type === 'primary' && <span className={styles.primaryBadgeSmall}>Primary</span>}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      <textarea
                        className={styles.messageTextarea}
                        placeholder="Type your message here..."
                        value={bulkMessageContent}
                        onChange={(e) => setBulkMessageContent(e.target.value)}
                        disabled={sendingBulkMessage}
                        style={{
                          minHeight: '200px',
                          height: '200px',
                          width: '100%',
                          display: 'block',
                          boxSizing: 'border-box',
                          padding: '0.75rem',
                          fontSize: '0.9375rem',
                          lineHeight: '1.5',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          resize: 'vertical',
                          outline: 'none',
                          marginTop: '0.75rem',
                          flexShrink: 0
                        }}
                      />
                      <div className={styles.messageCharCount}>
                        {bulkMessageContent.length} characters • {selectedMemberIds.size} recipient{selectedMemberIds.size !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className={styles.modalFooter}>
                      <button
                        className={styles.modalCancelButton}
                        onClick={() => {
                          setIsBulkMessageModalOpen(false);
                          setBulkMessageContent('');
                          setSelectedMemberIds(new Set());
                          setSelectAll(true);
                          setShowPreview(false);
                        }}
                        disabled={sendingBulkMessage}
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.modalSendButton}
                        onClick={handleDraftMessage}
                        disabled={!bulkMessageContent.trim() || selectedMemberIds.size === 0 || sendingBulkMessage}
                      >
                        Preview
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.modalBody}>
                      <div className={styles.previewSection}>
                        <h3 className={styles.previewTitle}>Message Preview</h3>
                        <div className={styles.previewMessage}>
                          {bulkMessageContent}
                        </div>
                        <div className={styles.previewInfo}>
                          <div className={styles.previewStat}>
                            <span className={styles.previewStatLabel}>Recipients:</span>
                            <span className={styles.previewStatValue}>
                              {selectedMemberIds.size} member{selectedMemberIds.size !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className={styles.previewStat}>
                            <span className={styles.previewStatLabel}>Length:</span>
                            <span className={styles.previewStatValue}>
                              {bulkMessageContent.length} characters
                            </span>
                          </div>
                        </div>
                        <div className={styles.confirmationWarning}>
                          ⚠️ Are you sure you want to send this message to <strong>{selectedMemberIds.size} member{selectedMemberIds.size !== 1 ? 's' : ''}</strong>?
                        </div>
                      </div>
                    </div>
                    <div className={styles.modalFooter}>
                      <button
                        className={styles.modalCancelButton}
                        onClick={() => setShowPreview(false)}
                        disabled={sendingBulkMessage}
                      >
                        Back to Edit
                      </button>
                      <button
                        className={styles.modalConfirmButton}
                        onClick={handleConfirmSend}
                        disabled={sendingBulkMessage}
                      >
                        {sendingBulkMessage ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Sending...
                          </>
                        ) : (
                          'Send'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className={styles.modalBody}>
                <div className={styles.resultsSummary}>
                  <h3 className={styles.resultsTitle}>Message Sent!</h3>
                  <div className={styles.resultsStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Total:</span>
                      <span className={styles.statValue}>{bulkMessageResults.total}</span>
                    </div>
                    <div className={`${styles.statItem} ${styles.statSuccess}`}>
                      <span className={styles.statLabel}>Sent:</span>
                      <span className={styles.statValue}>{bulkMessageResults.sent}</span>
                    </div>
                    <div className={`${styles.statItem} ${styles.statError}`}>
                      <span className={styles.statLabel}>Failed:</span>
                      <span className={styles.statValue}>{bulkMessageResults.failed}</span>
                    </div>
                  </div>
                </div>
                {bulkMessageResults.failed > 0 && (
                  <div className={styles.failedList}>
                    <h4 className={styles.failedTitle}>Failed to Send:</h4>
                    <div className={styles.failedItems}>
                      {bulkMessageResults.results
                        .filter((r: any) => r.status === 'failed')
                        .map((result: any, idx: number) => (
                          <div key={idx} className={styles.failedItem}>
                            <span className={styles.failedName}>{result.member_name}</span>
                            <span className={styles.failedError}>{result.error}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                <div className={styles.modalFooter}>
                  <button
                    className={styles.modalCloseButton}
                    onClick={() => {
                      setIsBulkMessageModalOpen(false);
                      setBulkMessageContent('');
                      setBulkMessageResults(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
