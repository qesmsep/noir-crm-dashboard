import { useEffect, useState } from "react";
import React from "react";
import { Spinner, useToast } from "@chakra-ui/react";
import { useRouter } from "next/router";
import Image from "next/image";
import { getSupabaseClient } from "../api/supabaseClient";
import AdminLayout from '../../components/layouts/AdminLayout';
import AddMemberModal from '../../components/members/AddMemberModal';
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
  primary?: boolean;
  dob?: string;
}

interface LedgerTransaction {
  account_id: string;
  member_id: string;
  type: 'payment' | 'purchase';
  amount: number;
}

type SortField = 'name' | 'join_date' | 'renewal_date' | 'ltv' | null;
type SortDirection = 'asc' | 'desc';

export default function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('membersSortField');
      return (saved === 'name' || saved === 'join_date' || saved === 'renewal_date' || saved === 'ltv') ? saved : null;
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
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    fetchMembers();
    fetchLedger();
  }, []);

  // Initialize selected members when modal opens
  useEffect(() => {
    if (isBulkMessageModalOpen && selectAll) {
      const allMemberIds = new Set(
        sortedAccounts.flatMap(account => account.allMembers.map(m => m.member_id))
      );
      setSelectedMemberIds(allMemberIds);
    }
  }, [isBulkMessageModalOpen, selectAll]);

  async function fetchMembers() {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('deactivated', false);
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLedger() {
    try {
      const res = await fetch('/api/ledger');
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setLedger(result.data || []);
    } catch (err: any) {
      console.error('Error fetching ledger:', err);
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateShort = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate LTV for an account (sum of all payment transactions)
  const calculateAccountLTV = (accountId: string) => {
    if (!ledger || ledger.length === 0) return 0;
    return ledger
      .filter(tx => tx.account_id === accountId && tx.type === 'payment' && tx.amount > 0)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  // Calculate next renewal date from join_date
  const getNextRenewal = (joinDate?: string): Date | null => {
    if (!joinDate) return null;
    const jd = new Date(joinDate);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    const day = jd.getDate();
    let candidate = new Date(year, month, day);
    if (candidate < today) {
      if (month === 11) { year += 1; month = 0; }
      else { month += 1; }
      candidate = new Date(year, month, day);
    }
    return candidate;
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
    ltv: number;
    join_date?: string;
    renewal_date: Date | null;
  }

  const accounts: AccountSummary[] = Object.entries(
    filteredMembers.reduce((acc, member) => {
      if (!acc[member.account_id]) acc[member.account_id] = [];
      acc[member.account_id].push(member);
      return acc;
    }, {} as { [accountId: string]: Member[] })
  ).map(([accountId, accountMembers]) => {
    const primary = accountMembers.find(m => m.primary) || accountMembers[0];
    return {
      account_id: accountId,
      primaryMember: primary,
      allMembers: accountMembers,
      ltv: calculateAccountLTV(accountId),
      join_date: primary.join_date,
      renewal_date: getNextRenewal(primary.join_date),
    };
  });

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

  // Sort accounts
  const sortedAccounts = [...accounts].sort((a, b) => {
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
      case 'ltv':
        comparison = a.ltv - b.ltv;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Initialize selected members when modal opens
  useEffect(() => {
    if (isBulkMessageModalOpen && selectAll) {
      const allMemberIds = new Set(
        sortedAccounts.flatMap(account => account.allMembers.map(m => m.member_id))
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
        sortedAccounts.flatMap(account => account.allMembers.map(m => m.member_id))
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
        isClosable: true,
      });
      return;
    }

    if (selectedMemberIds.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one member",
        status: "error",
        duration: 3000,
        isClosable: true,
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
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error sending bulk message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send bulk message",
        status: "error",
        duration: 5000,
        isClosable: true,
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
        isClosable: true,
      });

      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error('Error creating member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create member",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <AdminLayout>
        <div className={styles.loading}>
          <Spinner size="xl" color="#007aff" />
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
            <span className={styles.memberCount}>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
          </div>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, email, or phone..."
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
            />
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
            </button>
          </div>
        </div>

        {/* Members Table */}
        {sortedAccounts.length === 0 ? (
          <div className={styles.emptyState}>
            No members found
          </div>
        ) : (
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
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => {
                  const sortedMembers = account.allMembers.sort((a, b) => a.primary === b.primary ? 0 : a.primary ? -1 : 1);
                  const member1 = sortedMembers[0];
                  const member2 = sortedMembers[1] || null;
                  
                  return (
                    <tr
                      key={account.account_id}
                      className={styles.tableRow}
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
                                {member1.primary && (
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
                                {member2.primary && (
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
                        {formatCurrency(account.ltv)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveMember}
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
                              Select All ({sortedAccounts.reduce((sum, acc) => sum + acc.allMembers.length, 0)} members)
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
                                    {member.primary && <span className={styles.primaryBadgeSmall}>Primary</span>}
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
                            <Spinner size="sm" mr={2} />
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
