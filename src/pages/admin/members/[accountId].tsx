import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Spinner, useToast } from "@chakra-ui/react";
import Image from "next/image";
import { getSupabaseClient } from "../../api/supabaseClient";
import AdminLayout from '../../../components/layouts/AdminLayout';
import InlineAttachments from '../../../components/InlineAttachments';
import styles from '../../../styles/MemberDetail.module.css';

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
  company?: string;
  referred_by?: string;
  next_renewal?: string;
  ledger_notifications_enabled?: boolean;
}

interface Message {
  id: string;
  member_id: string;
  account_id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'failed' | 'pending';
  phone_number: string;
  error_message?: string;
  created_at: string;
}

interface LedgerTransaction {
  id: string;
  member_id: string;
  account_id: string;
  type: 'payment' | 'purchase';
  amount: number;
  note?: string;
  date: string;
  created_at: string;
}

interface Attribute {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

interface Note {
  id: string;
  note: string;
  created_at: string;
}

export default function MemberDetailAdmin() {
  const router = useRouter();
  const { accountId } = router.query;
  const toast = useToast();

  // Data states
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memberAttributes, setMemberAttributes] = useState<Record<string, Attribute[]>>({});
  const [memberNotes, setMemberNotes] = useState<Record<string, Note[]>>({});

  // Loading states
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing states
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberData, setEditingMemberData] = useState<Partial<Member>>({});

  // Transaction states
  const [newTransaction, setNewTransaction] = useState<Partial<LedgerTransaction>>({});
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionData, setEditingTransactionData] = useState<Partial<LedgerTransaction>>({});
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

  // Attribute states (per member)
  const [newAttribute, setNewAttribute] = useState<Record<string, { key: string; value: string }>>({});
  const [editingAttributeId, setEditingAttributeId] = useState<Record<string, string | null>>({});
  const [editingAttributeData, setEditingAttributeData] = useState<Record<string, { key: string; value: string }>>({});

  // Note states (per member)
  const [newNote, setNewNote] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<Record<string, string | null>>({});
  const [editingNoteData, setEditingNoteData] = useState<Record<string, string>>({});

  // Payment states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch members
  useEffect(() => {
    if (!accountId) return;

    async function fetchMembers() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('account_id', accountId)
          .eq('deactivated', false);

        if (error) throw error;

        // Sort members: primary first
        const sorted = (data || []).sort((a, b) => {
          if (a.primary && !b.primary) return -1;
          if (!a.primary && b.primary) return 1;
          return 0;
        });
        setMembers(sorted);
      } catch (err: any) {
        setError(err.message);
        toast({
          title: 'Error loading members',
          description: err.message,
          status: 'error',
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchMembers();
  }, [accountId, toast]);

  // Fetch ledger
  useEffect(() => {
    if (!accountId) return;

    async function fetchLedger() {
      setLedgerLoading(true);
      try {
        const res = await fetch(`/api/ledger?account_id=${accountId}`);
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setLedger(result.data || []);
      } catch (err: any) {
        console.error('Ledger fetch error:', err);
        toast({
          title: 'Error loading ledger',
          description: err.message,
          status: 'error',
          duration: 5000,
        });
      } finally {
        setLedgerLoading(false);
      }
    }

    fetchLedger();
  }, [accountId, toast]);

  // Fetch messages
  useEffect(() => {
    if (!accountId) return;

    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/messages?account_id=${accountId}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setMessages(result.messages || []);
      } catch (err: any) {
        console.error('Messages fetch error:', err);
        toast({
          title: 'Error loading messages',
          description: err.message,
          status: 'error',
          duration: 5000,
        });
      } finally {
        setMessagesLoading(false);
      }
    }

    fetchMessages();
  }, [accountId, toast]);

  // Fetch attributes for a member
  const fetchMemberAttributes = async (memberId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('member_attributes')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemberAttributes(prev => ({ ...prev, [memberId]: data || [] }));
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
    }
  };

  // Fetch notes for a member
  const fetchMemberNotes = async (memberId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('member_notes')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemberNotes(prev => ({ ...prev, [memberId]: data || [] }));
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    }
  };

  // Fetch attributes and notes when members load
  useEffect(() => {
    members.forEach(member => {
      fetchMemberAttributes(member.member_id);
      fetchMemberNotes(member.member_id);
    });
  }, [members]);

  // Helper functions
  const formatDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatLedgerDate = (date: string) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}.${day}.${year}`;
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '').slice(-10).padStart(10, '0');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Member update handler
  const handleUpdateMember = async (memberId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('members')
        .update(editingMemberData)
        .eq('member_id', memberId);

      if (error) throw error;

      setMembers(prev =>
        prev.map(m => (m.member_id === memberId ? { ...m, ...editingMemberData } : m))
      );
      setEditingMemberId(null);
      setEditingMemberData({});

      toast({
        title: 'Member updated',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error updating member',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Transaction handlers
  const handleAddTransaction = async () => {
    if (!newTransaction.type || !newTransaction.amount || !newTransaction.member_id) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTransaction,
          account_id: accountId,
          date: newTransaction.date || new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setNewTransaction({});

      // Refresh ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      if (ledgerResult.error) throw new Error(ledgerResult.error);
      setLedger(ledgerResult.data || []);

      toast({
        title: 'Transaction added',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error adding transaction',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleUpdateTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/ledger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transactionId,
          ...editingTransactionData,
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setEditingTransactionId(null);
      setEditingTransactionData({});

      // Refresh ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      if (ledgerResult.error) throw new Error(ledgerResult.error);
      setLedger(ledgerResult.data || []);

      toast({
        title: 'Transaction updated',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error updating transaction',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/ledger', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transactionId }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Refresh ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      if (ledgerResult.error) throw new Error(ledgerResult.error);
      setLedger(ledgerResult.data || []);

      toast({
        title: 'Transaction deleted',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error deleting transaction',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Attribute handlers
  const handleAddAttribute = async (memberId: string) => {
    if (!newAttribute[memberId]?.key || !newAttribute[memberId]?.value) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both key and value',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_attributes')
        .insert({
          member_id: memberId,
          key: newAttribute[memberId].key,
          value: newAttribute[memberId].value,
        });

      if (error) throw error;

      setNewAttribute(prev => ({ ...prev, [memberId]: { key: '', value: '' } }));
      await fetchMemberAttributes(memberId);

      toast({
        title: 'Attribute added',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error adding attribute',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleUpdateAttribute = async (memberId: string, attributeId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_attributes')
        .update({
          key: editingAttributeData[memberId]?.key,
          value: editingAttributeData[memberId]?.value,
        })
        .eq('id', attributeId);

      if (error) throw error;

      setEditingAttributeId(prev => ({ ...prev, [memberId]: null }));
      setEditingAttributeData(prev => ({ ...prev, [memberId]: { key: '', value: '' } }));
      await fetchMemberAttributes(memberId);

      toast({
        title: 'Attribute updated',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error updating attribute',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteAttribute = async (memberId: string, attributeId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_attributes')
        .delete()
        .eq('id', attributeId);

      if (error) throw error;

      await fetchMemberAttributes(memberId);

      toast({
        title: 'Attribute deleted',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error deleting attribute',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Note handlers
  const handleAddNote = async (memberId: string) => {
    if (!newNote[memberId]) {
      toast({
        title: 'Missing note',
        description: 'Please enter a note',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_notes')
        .insert({
          member_id: memberId,
          note: newNote[memberId],
        });

      if (error) throw error;

      setNewNote(prev => ({ ...prev, [memberId]: '' }));
      await fetchMemberNotes(memberId);

      toast({
        title: 'Note added',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error adding note',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleUpdateNote = async (memberId: string, noteId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_notes')
        .update({ note: editingNoteData[memberId] })
        .eq('id', noteId);

      if (error) throw error;

      setEditingNoteId(prev => ({ ...prev, [memberId]: null }));
      setEditingNoteData(prev => ({ ...prev, [memberId]: '' }));
      await fetchMemberNotes(memberId);

      toast({
        title: 'Note updated',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error updating note',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteNote = async (memberId: string, noteId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('member_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      await fetchMemberNotes(memberId);

      toast({
        title: 'Note deleted',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error deleting note',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Calculate running balance
  const calculateRunningBalance = (transactions: LedgerTransaction[], currentIndex: number) => {
    if (!transactions || currentIndex < 0) return 0;
    return transactions.slice(0, currentIndex + 1).reduce((acc, t) => acc + Number(t.amount), 0);
  };

  // Calculate LTV (Lifetime Value) for a member - sum of all payment transactions
  const calculateMemberLTV = (memberId: string) => {
    if (!ledger || ledger.length === 0) return 0;
    return ledger
      .filter(tx => tx.member_id === memberId && tx.type === 'payment' && tx.amount > 0)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  // Handle Stripe payment
  const handlePayBalance = async () => {
    if (!accountId) {
      toast({
        title: 'Error',
        description: 'No account selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/chargeBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payment');
      }

      toast({
        title: 'Payment Successful',
        description: 'The balance has been paid successfully',
        status: 'success',
        duration: 5000,
      });

      // Refresh the ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      setLedger(ledgerResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle archive member
  const handleArchiveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to archive ${memberName}? They will be removed from the active members list.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive member');
      }

      toast({
        title: 'Member Archived',
        description: `${memberName} has been archived successfully`,
        status: 'success',
        duration: 3000,
      });

      // Redirect back to members list
      router.push('/admin/members');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive member',
        status: 'error',
        duration: 5000,
      });
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
          <div className={styles.error}>
            Error loading member: {error}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button
            onClick={() => router.push('/admin/members')}
            className={styles.backButton}
          >
            ← Back to Members
          </button>
        </div>

        <div className={styles.contentLayout}>
          <div className={styles.topRow}>
            <div className={styles.profileColumn}>
              {/* Member Cards */}
              <div className={styles.membersSection}>
                <h2 className={styles.sectionTitle}>Account Members</h2>
                <div className={styles.membersGrid}>
                  {members.map(member => (
                  <div key={member.member_id} className={styles.memberCard}>
                    {/* Member Header */}
                    <div className={styles.memberHeader}>
                      {member.photo ? (
                        <div className={styles.memberPhoto}>
                          <Image
                            src={member.photo}
                            alt={`${member.first_name} ${member.last_name}`}
                            width={150}
                            height={150}
                            style={{ objectFit: 'cover', borderRadius: '50%' }}
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className={styles.photoPlaceholder}>
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </div>
                      )}
                      <div className={styles.memberInfo}>
                        <h3 className={styles.memberName}>
                          {member.first_name} {member.last_name}
                          {member.primary && (
                            <span className={styles.primaryBadge}>Primary</span>
                          )}
                        </h3>
                        {editingMemberId === member.member_id ? (
                          <div className={styles.memberDetailsInline}>
                            <input
                              type="email"
                              placeholder="Email"
                              className={styles.input}
                              value={editingMemberData.email || ''}
                              onChange={(e) => setEditingMemberData({ ...editingMemberData, email: e.target.value })}
                            />
                            <input
                              type="tel"
                              placeholder="Phone"
                              className={styles.input}
                              value={editingMemberData.phone || ''}
                              onChange={(e) => setEditingMemberData({ ...editingMemberData, phone: e.target.value })}
                            />
                            <input
                              type="text"
                              placeholder="Company"
                              className={styles.input}
                              value={editingMemberData.company || ''}
                              onChange={(e) => setEditingMemberData({ ...editingMemberData, company: e.target.value })}
                            />
                            <input
                              type="date"
                              className={styles.input}
                              value={editingMemberData.dob || ''}
                              onChange={(e) => setEditingMemberData({ ...editingMemberData, dob: e.target.value })}
                            />
                            <div className={styles.editActions}>
                              <button
                                onClick={() => handleUpdateMember(member.member_id)}
                                className={styles.saveButton}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMemberId(null);
                                  setEditingMemberData({});
                                }}
                                className={styles.cancelButton}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleArchiveMember(member.member_id, `${member.first_name} ${member.last_name}`)}
                                className={styles.archiveIconButton}
                                title="Archive Member"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.contactInfoInline}>
                            {member.email && (
                              <div className={styles.detailRow}>
                                <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                </svg>
                                <span>{member.email}</span>
                              </div>
                            )}
                            {member.phone && (
                              <div className={styles.detailRow}>
                                <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                                <span>{formatPhone(member.phone)}</span>
                              </div>
                            )}
                            {member.company && (
                              <div className={styles.detailRow}>
                                <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                </svg>
                                <span>{member.company}</span>
                              </div>
                            )}
                            {member.dob && (
                              <div className={styles.detailRow}>
                                <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                <span>{formatDate(member.dob)}</span>
                              </div>
                            )}
                            <div className={styles.detailRowWithAction}>
                              <div className={styles.detailRow}>
                                <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.343 1.152V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.344-1.152V5z" clipRule="evenodd" />
                                </svg>
                                <span>LTV: {formatCurrency(calculateMemberLTV(member.member_id))}</span>
                              </div>
                              {editingMemberId !== member.member_id && (
                                <button
                                  onClick={() => {
                                    setEditingMemberId(member.member_id);
                                    setEditingMemberData(member);
                                  }}
                                  className={styles.iconButton}
                                  title="Edit Member"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attributes Section */}
                    <div className={styles.section}>
                      <h4 className={styles.subsectionTitle}>Attributes</h4>
                      {memberAttributes[member.member_id]?.map(attr => (
                        <div key={attr.id} className={styles.attributeItem}>
                          {editingAttributeId[member.member_id] === attr.id ? (
                            <>
                              <input
                                type="text"
                                className={styles.smallInput}
                                value={editingAttributeData[member.member_id]?.key || ''}
                                onChange={(e) => setEditingAttributeData({
                                  ...editingAttributeData,
                                  [member.member_id]: {
                                    ...editingAttributeData[member.member_id],
                                    key: e.target.value
                                  }
                                })}
                              />
                              <input
                                type="text"
                                className={styles.smallInput}
                                value={editingAttributeData[member.member_id]?.value || ''}
                                onChange={(e) => setEditingAttributeData({
                                  ...editingAttributeData,
                                  [member.member_id]: {
                                    ...editingAttributeData[member.member_id],
                                    value: e.target.value
                                  }
                                })}
                              />
                              <button
                                onClick={() => handleUpdateAttribute(member.member_id, attr.id)}
                                className={styles.smallButton}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingAttributeId({ ...editingAttributeId, [member.member_id]: null })}
                                className={styles.smallButton}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <div className={styles.attributeKey}>{attr.key}:</div>
                              <div className={styles.attributeValue}>{attr.value}</div>
                              <button
                                onClick={() => {
                                  setEditingAttributeId({ ...editingAttributeId, [member.member_id]: attr.id });
                                  setEditingAttributeData({
                                    ...editingAttributeData,
                                    [member.member_id]: { key: attr.key, value: attr.value }
                                  });
                                }}
                                className={styles.smallButton}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAttribute(member.member_id, attr.id)}
                                className={styles.smallButton}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <div className={styles.addAttributeForm}>
                        <input
                          type="text"
                          placeholder="Key"
                          className={styles.smallInput}
                          value={newAttribute[member.member_id]?.key || ''}
                          onChange={(e) => setNewAttribute({
                            ...newAttribute,
                            [member.member_id]: { ...newAttribute[member.member_id], key: e.target.value }
                          })}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          className={styles.smallInput}
                          value={newAttribute[member.member_id]?.value || ''}
                          onChange={(e) => setNewAttribute({
                            ...newAttribute,
                            [member.member_id]: { ...newAttribute[member.member_id], value: e.target.value }
                          })}
                        />
                        <button
                          onClick={() => handleAddAttribute(member.member_id)}
                          className={styles.addButton}
                          aria-label="Add attribute"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className={styles.section}>
                      <h4 className={styles.subsectionTitle}>Notes</h4>
                      {memberNotes[member.member_id]?.map(note => (
                        <div key={note.id} className={styles.noteItem}>
                          {editingNoteId[member.member_id] === note.id ? (
                            <>
                              <textarea
                                className={styles.textarea}
                                value={editingNoteData[member.member_id] || ''}
                                onChange={(e) => setEditingNoteData({
                                  ...editingNoteData,
                                  [member.member_id]: e.target.value
                                })}
                              />
                              <button
                                onClick={() => handleUpdateNote(member.member_id, note.id)}
                                className={styles.smallButton}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingNoteId({ ...editingNoteId, [member.member_id]: null })}
                                className={styles.smallButton}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <div className={styles.noteContent}>{note.note}</div>
                              <div className={styles.noteDate}>{formatDate(note.created_at)}</div>
                              <button
                                onClick={() => {
                                  setEditingNoteId({ ...editingNoteId, [member.member_id]: note.id });
                                  setEditingNoteData({ ...editingNoteData, [member.member_id]: note.note });
                                }}
                                className={styles.smallButton}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNote(member.member_id, note.id)}
                                className={styles.smallButton}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <div className={styles.addNoteForm}>
                        <textarea
                          placeholder="Add a note..."
                          className={styles.textarea}
                          value={newNote[member.member_id] || ''}
                          onChange={(e) => setNewNote({ ...newNote, [member.member_id]: e.target.value })}
                        />
                        <button
                          onClick={() => handleAddNote(member.member_id)}
                          className={styles.addButton}
                          aria-label="Add note"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className={styles.ledgerColumn}>
            {/* Ledger Section */}
            <div className={styles.ledgerSection}>
              <div className={styles.ledgerHeader}>
                <h2 className={styles.sectionTitle}>Account Ledger</h2>
                <div className={styles.ledgerHeaderActions}>
                  {!ledgerLoading && ledger.length > 0 && (
                    <>
                      <div className={styles.currentBalance}>
                        Balance: {formatCurrency(calculateRunningBalance(ledger, ledger.length - 1))}
                      </div>
                      {calculateRunningBalance(ledger, ledger.length - 1) < 0 && (
                        <button
                          onClick={handlePayBalance}
                          disabled={isProcessingPayment}
                          className={styles.payBalanceButton}
                        >
                          {isProcessingPayment ? 'Processing...' : 'Pay Balance'}
                        </button>
                      )}
                    </>
                  )}
                  {!ledgerLoading && (
                    <button
                      onClick={() => setNewTransaction(newTransaction.member_id ? {} : { date: new Date().toISOString().split('T')[0] })}
                      className={styles.toggleFormButton}
                      aria-label={newTransaction.member_id || newTransaction.type ? 'Cancel' : 'Add Transaction'}
                    >
                      {newTransaction.member_id || newTransaction.type ? '−' : '+'}
                    </button>
                  )}
                </div>
              </div>

              {ledgerLoading ? (
            <div className={styles.sectionLoading}>
              <Spinner size="md" color="#007aff" />
            </div>
          ) : (
            <>

              {(newTransaction.member_id || newTransaction.type || newTransaction.date) && (
                <div className={styles.compactForm}>
                  <select
                    className={styles.compactSelect}
                    value={newTransaction.member_id || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, member_id: e.target.value })}
                  >
                    <option value="">Member</option>
                    {members.map(m => (
                      <option key={m.member_id} value={m.member_id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.compactSelect}
                    value={newTransaction.type || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, type: e.target.value as 'payment' | 'purchase' })}
                  >
                    <option value="">Type</option>
                    <option value="payment">Payment</option>
                    <option value="purchase">Purchase</option>
                  </select>
                  <input
                    type="number"
                    placeholder="$0.00"
                    className={styles.compactInput}
                    value={newTransaction.amount || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    className={styles.compactInput}
                    value={newTransaction.note || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, note: e.target.value })}
                  />
                  <input
                    type="date"
                    className={styles.compactInput}
                    value={newTransaction.date || ''}
                    onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  />
                  <button onClick={handleAddTransaction} className={styles.compactAddButton}>
                    Add
                  </button>
                </div>
              )}

              {/* Transactions Table - Compact */}
              {ledger.length === 0 ? (
                <div className={styles.emptyLedger}>No transactions yet</div>
              ) : (
                <div className={styles.ledgerTable}>
                  {ledger.map((tx, idx) => {
                    const txMember = members.find(m => m.member_id === tx.member_id);
                    const isEditing = editingTransactionId === tx.id;

                    const isExpanded = expandedTransactionId === tx.id;
                    
                    return (
                      <div key={tx.id} className={styles.ledgerRow}>
                        {isEditing ? (
                          <div className={styles.ledgerRowEdit}>
                            <input
                              type="date"
                              className={styles.compactInput}
                              value={editingTransactionData.date || ''}
                              onChange={(e) => setEditingTransactionData({ ...editingTransactionData, date: e.target.value })}
                            />
                            <select
                              className={styles.compactSelect}
                              value={editingTransactionData.type || ''}
                              onChange={(e) => setEditingTransactionData({ ...editingTransactionData, type: e.target.value as 'payment' | 'purchase' })}
                            >
                              <option value="payment">Payment</option>
                              <option value="purchase">Purchase</option>
                            </select>
                            <input
                              type="number"
                              className={styles.compactInput}
                              value={Math.abs(editingTransactionData.amount || 0)}
                              onChange={(e) => setEditingTransactionData({ ...editingTransactionData, amount: parseFloat(e.target.value) })}
                            />
                            <input
                              type="text"
                              placeholder="Note"
                              className={styles.compactInput}
                              value={editingTransactionData.note || ''}
                              onChange={(e) => setEditingTransactionData({ ...editingTransactionData, note: e.target.value })}
                            />
                            <div className={styles.ledgerRowActions}>
                              <button onClick={() => handleUpdateTransaction(tx.id)} className={styles.iconButton}>
                                ✓
                              </button>
                              <button onClick={() => setEditingTransactionId(null)} className={styles.iconButton}>
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div 
                              className={styles.ledgerRowContent}
                              onClick={() => setExpandedTransactionId(isExpanded ? null : tx.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.ledgerRowMain}>
                                <div className={styles.ledgerDate}>
                                  {formatLedgerDate(tx.date)}
                                </div>
                                <div className={styles.ledgerInfo}>
                                  {tx.note && <div className={styles.ledgerNote}>{tx.note}</div>}
                                  {!tx.note && (
                                    <div className={styles.ledgerMember}>
                                      {txMember ? `${txMember.first_name} ${txMember.last_name}` : 'Unknown'}
                                    </div>
                                  )}
                                </div>
                                <div className={styles.ledgerRowRight}>
                                  <div className={`${styles.ledgerAmount} ${tx.amount < 0 ? styles.negative : styles.positive}`}>
                                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                  </div>
                                </div>
                                <div className={styles.ledgerRowActions}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTransactionId(tx.id);
                                      setEditingTransactionData(tx);
                                    }}
                                    className={styles.iconButton}
                                    title="Edit"
                                  >
                                    ✎
                                  </button>
                                </div>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className={styles.ledgerRowDetails} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Member:</span>
                                  <span>{txMember ? `${txMember.first_name} ${txMember.last_name}` : 'Unknown'}</span>
                                </div>
                                {tx.note && (
                                  <div className={styles.ledgerDetailRow}>
                                    <span className={styles.ledgerDetailLabel}>Note:</span>
                                    <span>{tx.note}</span>
                                  </div>
                                )}
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Type:</span>
                                  <span>{tx.type === 'payment' ? 'Payment' : 'Purchase'}</span>
                                </div>
                                <div className={styles.ledgerRowActions}>
                                  <button
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className={styles.iconButton}
                                    title="Delete"
                                  >
                                    🗑
                                  </button>
                                </div>
                                <InlineAttachments
                                  ledgerId={tx.id}
                                  memberId={tx.member_id}
                                  accountId={accountId as string}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
              )}
            </div>
          </div>
          </div>

          <div className={styles.messagesColumn}>
            {/* Messages Section */}
            <div className={styles.messagesSection}>
              <h2 className={styles.sectionTitle}>Messages</h2>
              {messagesLoading ? (
                <div className={styles.sectionLoading}>
                  <Spinner size="md" color="#007aff" />
                </div>
              ) : (
                <div className={styles.messagesList}>
                  {messages.length === 0 ? (
                    <div className={styles.emptyState}>No messages yet</div>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={styles.messageItem}>
                        <div className={styles.messageDirection}>
                          {msg.direction === 'inbound' ? '← Received' : '→ Sent'}
                        </div>
                        <div className={styles.messageContent}>{msg.content}</div>
                        <div className={styles.messageDate}>{formatDate(msg.created_at)}</div>
                        {msg.status === 'failed' && (
                          <div className={styles.messageError}>
                            Failed: {msg.error_message}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
