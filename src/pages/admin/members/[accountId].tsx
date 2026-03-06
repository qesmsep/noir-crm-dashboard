import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/useToast";
import Image from "next/image";
import { getSupabaseClient } from "../../api/supabaseClient";
import AdminLayout from '../../../components/layouts/AdminLayout';
import InlineAttachments from '../../../components/InlineAttachments';
import MemberSubscriptionCard from '../../../components/MemberSubscriptionCard';
import AddSecondaryMemberModal from '../../../components/AddSecondaryMemberModal';
import PhotoCropUpload from '../../../components/PhotoCropUpload';
import styles from '../../../styles/MemberDetail.module.css';
import { getTodayLocalDate } from '@/lib/utils';

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
  const { toast } = useToast();

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
  const [transactionAttachments, setTransactionAttachments] = useState<Record<string, any[]>>({});

  // Attribute states (per member)
  const [newAttribute, setNewAttribute] = useState<Record<string, { key: string; value: string }>>({});
  const [editingAttributeId, setEditingAttributeId] = useState<Record<string, string | null>>({});
  const [editingAttributeData, setEditingAttributeData] = useState<Record<string, { key: string; value: string }>>({});

  // Search state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Note states (per member)
  const [newNote, setNewNote] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<Record<string, string | null>>({});
  const [editingNoteData, setEditingNoteData] = useState<Record<string, string>>({});

  // Send login info state
  const [sendingLoginInfo, setSendingLoginInfo] = useState(false);

  // Payment states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [customChargeAmount, setCustomChargeAmount] = useState('');
  const [customChargeDescription, setCustomChargeDescription] = useState('');

  // Credit states
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');

  // Manual charge states
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');

  // Ledger actions card expansion
  const [isLedgerActionsExpanded, setIsLedgerActionsExpanded] = useState(false);

  // Add secondary member modal
  const [showAddSecondaryModal, setShowAddSecondaryModal] = useState(false);

  // Credit card fee toggle
  const [creditCardFeeEnabled, setCreditCardFeeEnabled] = useState(false);
  const [updatingFeeToggle, setUpdatingFeeToggle] = useState(false);

  // Member card expansion
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set());

  const toggleMemberExpansion = (memberId: string) => {
    setExpandedMemberIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  // Fetch members and account settings
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
          if (a.member_type === 'primary' && b.member_type !== 'primary') return -1;
          if (a.member_type !== 'primary' && b.member_type === 'primary') return 1;
          return 0;
        });
        setMembers(sorted);
      } catch (err: any) {
        setError(err.message);
        toast({
          title: 'Error loading members',
          description: err.message,
          variant: 'error',
        });
      } finally {
        setLoading(false);
      }
    }

    async function fetchAccountSettings() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('accounts')
          .select('credit_card_fee_enabled')
          .eq('account_id', accountId)
          .single();

        if (error) {
          // If column doesn't exist yet, silently ignore
          if (!error.message?.includes('column')) {
            console.error('Error fetching account settings:', error);
          }
          return;
        }

        setCreditCardFeeEnabled(data?.credit_card_fee_enabled || false);
      } catch (err: any) {
        console.error('Error fetching account settings:', err);
      }
    }

    fetchMembers();
    fetchAccountSettings();
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
        // Sort by date descending (most recent first)
        const sortedLedger = (result.data || []).sort((a: LedgerTransaction, b: LedgerTransaction) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        setLedger(sortedLedger);
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

  // Fetch attachments for each ledger transaction
  useEffect(() => {
    if (ledger.length === 0) return;

    const fetchAllAttachments = async () => {
      const attachmentsMap: Record<string, any[]> = {};

      await Promise.all(
        ledger.map(async (tx) => {
          try {
            const response = await fetch(`/api/transaction-attachments/${tx.id}`);
            if (response.ok) {
              const result = await response.json();
              attachmentsMap[tx.id] = result.data || result.attachments || [];
            }
          } catch (error) {
            console.error(`Error fetching attachments for transaction ${tx.id}:`, error);
            attachmentsMap[tx.id] = [];
          }
        })
      );

      setTransactionAttachments(attachmentsMap);
    };

    fetchAllAttachments();
  }, [ledger]);

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
      const response = await fetch(`/api/member_attributes?member_id=${memberId}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to fetch attributes');

      setMemberAttributes(prev => ({ ...prev, [memberId]: result.data || [] }));
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
    }
  };

  // Fetch notes for a member
  const fetchMemberNotes = async (memberId: string) => {
    try {
      const response = await fetch(`/api/member_notes?member_id=${memberId}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to fetch notes');

      setMemberNotes(prev => ({ ...prev, [memberId]: result.data || [] }));
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
    // Parse date string manually to avoid timezone issues
    const [year, month, day] = date.split('T')[0].split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatLedgerDate = (date: string) => {
    // Parse date string manually to avoid timezone issues
    const [year, month, day] = date.split('T')[0].split('-');
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

  // Search members
  const handleMemberSearch = async (query: string) => {
    setMemberSearch(query);

    if (!query || query.length < 2) {
      setMemberSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const searchLower = query.toLowerCase();

      // Search members by name, email, or phone
      const { data, error } = await supabase
        .from('members')
        .select('member_id, account_id, first_name, last_name, email, phone, member_type')
        .or(`first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
        .limit(10);

      if (!error && data) {
        setMemberSearchResults(data);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching members:', error);
    }
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

  // Send login info handler
  const handleSendLoginInfo = async (memberId: string) => {
    const member = members.find(m => m.member_id === memberId);
    if (!member) return;

    const confirmed = window.confirm(
      `Send login information to ${member.first_name} ${member.last_name} at ${member.phone}?\n\nThis will generate a temporary password and send it via SMS.`
    );

    if (!confirmed) return;

    setSendingLoginInfo(true);

    try {
      const response = await fetch('/api/admin/send-login-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          generateTemporaryPassword: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send login information');
      }

      toast({
        title: 'Login information sent',
        description: data.message,
        status: 'success',
        duration: 5000,
      });
    } catch (err: any) {
      toast({
        title: 'Error sending login info',
        description: err.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSendingLoginInfo(false);
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
          date: newTransaction.date || getTodayLocalDate(),
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setNewTransaction({});

      // Refresh ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      if (ledgerResult.error) throw new Error(ledgerResult.error);
      // Sort by date descending (most recent first)
      const sortedLedger = (ledgerResult.data || []).sort((a: LedgerTransaction, b: LedgerTransaction) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setLedger(sortedLedger);

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
      // Sort by date descending (most recent first)
      const sortedLedger = (ledgerResult.data || []).sort((a: LedgerTransaction, b: LedgerTransaction) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setLedger(sortedLedger);

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
      // Sort by date descending (most recent first)
      const sortedLedger = (ledgerResult.data || []).sort((a: LedgerTransaction, b: LedgerTransaction) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setLedger(sortedLedger);

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
      const response = await fetch('/api/member_attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          key: newAttribute[memberId].key,
          value: newAttribute[memberId].value,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add attribute');

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
      const response = await fetch('/api/member_attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attributeId,
          member_id: memberId,
          key: editingAttributeData[memberId]?.key,
          value: editingAttributeData[memberId]?.value,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update attribute');

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
      const response = await fetch('/api/member_attributes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attributeId,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete attribute');

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
      const response = await fetch('/api/member_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          note: newNote[memberId],
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add note');

      setNewNote(prev => ({ ...prev, [memberId]: '' }));
      setMemberNotes(prev => ({ ...prev, [memberId]: result.data || [] }));

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
      const response = await fetch('/api/member_notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: noteId,
          member_id: memberId,
          note: editingNoteData[memberId],
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update note');

      setEditingNoteId(prev => ({ ...prev, [memberId]: null }));
      setEditingNoteData(prev => ({ ...prev, [memberId]: '' }));
      setMemberNotes(prev => ({ ...prev, [memberId]: result.data || [] }));

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
      const response = await fetch('/api/member_notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: noteId,
          member_id: memberId,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete note');

      setMemberNotes(prev => ({ ...prev, [memberId]: result.data || [] }));

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

  // Handle photo update
  const handlePhotoUpdate = async (memberId: string, photoDataUrl: string) => {
    try {
      console.log('Updating photo for member:', memberId);
      const supabase = getSupabaseClient();

      // Convert data URL to blob
      const response = await fetch(photoDataUrl);
      const blob = await response.blob();

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `member-${memberId}-${timestamp}.jpg`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('member-photos')
        .getPublicUrl(fileName);

      const photoUrl = urlData.publicUrl;

      console.log('Updating member_id:', memberId, 'with photo URL:', photoUrl);

      // Update member record
      const { data: updateData, error: updateError } = await supabase
        .from('members')
        .update({ photo: photoUrl })
        .eq('member_id', memberId)
        .select();

      if (updateError) throw updateError;

      console.log('Update result:', updateData);

      // Refetch members to ensure we have the latest data
      const { data: updatedMembers, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', accountId)
        .order('member_type', { ascending: false }); // Primary first

      if (fetchError) throw fetchError;

      if (updatedMembers) {
        setMembers(updatedMembers);
      }

      toast({
        title: 'Photo updated',
        description: 'Member photo has been updated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      console.error('Error updating photo:', err);
      toast({
        title: 'Error updating photo',
        description: err.message || 'Failed to update photo',
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Calculate running balance
  // Since ledger is sorted descending (newest first), we need to sum from the end (oldest) to current index
  const calculateRunningBalance = (transactions: LedgerTransaction[], currentIndex: number) => {
    if (!transactions || currentIndex < 0) return 0;
    // Sum all transactions from current index to end (includes all older transactions)
    return transactions.slice(currentIndex).reduce((acc, t) => acc + Number(t.amount), 0);
  };

  // Calculate LTV (Lifetime Value) for a member - sum of all payment transactions
  const calculateMemberLTV = (memberId: string) => {
    if (!ledger || ledger.length === 0) return 0;
    return ledger
      .filter(tx => tx.member_id === memberId && tx.type === 'payment' && tx.amount > 0)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  // Handle Stripe payment for outstanding balance
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

  // Handle custom charge (Stripe payment)
  const handleCustomCharge = async () => {
    if (!accountId) {
      toast({
        title: 'Error',
        description: 'No account selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const amount = parseFloat(customChargeAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than $0',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!customChargeDescription.trim()) {
      toast({
        title: 'Description Required',
        description: 'Please enter a description for this charge',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Confirmation dialog
    const confirmed = window.confirm(
      `Charge member's card $${amount.toFixed(2)} for:\n"${customChargeDescription.trim()}"\n\nThis will process a payment via Stripe.`
    );

    if (!confirmed) {
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
          custom_amount: amount,
          custom_description: customChargeDescription.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process charge');
      }

      toast({
        title: 'Payment Processed',
        description: `Successfully processed $${amount.toFixed(2)} payment: ${customChargeDescription}`,
        status: 'success',
        duration: 5000,
      });

      // Clear form
      setCustomChargeAmount('');
      setCustomChargeDescription('');

      // Refresh the ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      setLedger(ledgerResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Charge Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle credit card fee toggle
  const handleToggleCreditCardFee = async () => {
    if (!accountId) return;

    setUpdatingFeeToggle(true);
    try {
      const newValue = !creditCardFeeEnabled;

      const response = await fetch('/api/accounts/update-credit-card-fee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          enabled: newValue,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update fee setting');
      }

      setCreditCardFeeEnabled(newValue);
      toast({
        title: newValue ? '4% Fee Enabled' : '4% Fee Disabled',
        description: newValue
          ? 'Credit card transactions will include a 4% processing fee'
          : 'Credit card transactions will not include processing fees',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update fee setting',
        variant: 'error',
      });
    } finally {
      setUpdatingFeeToggle(false);
    }
  };

  // Handle add credit (ledger-only, no Stripe)
  const handleAddCredit = async () => {
    if (!accountId) {
      toast({
        title: 'Error',
        description: 'No account selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than $0',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!creditDescription.trim()) {
      toast({
        title: 'Description Required',
        description: 'Please enter a description for this credit',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      // Get primary member for this account
      const primaryMember = members.find(m => m.member_type === 'primary');
      if (!primaryMember) {
        throw new Error('No primary member found for this account');
      }

      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          member_id: primaryMember.member_id,
          type: 'payment',
          amount: amount,
          note: creditDescription.trim(),
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      toast({
        title: 'Credit Added',
        description: `Successfully added $${amount.toFixed(2)} credit: ${creditDescription}`,
        status: 'success',
        duration: 5000,
      });

      // Clear form
      setCreditAmount('');
      setCreditDescription('');

      // Refresh the ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      setLedger(ledgerResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Error Adding Credit',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Handle add charge (ledger-only, no Stripe)
  const handleAddCharge = async () => {
    if (!accountId) {
      toast({
        title: 'Error',
        description: 'No account selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const amount = parseFloat(chargeAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than $0',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!chargeDescription.trim()) {
      toast({
        title: 'Description Required',
        description: 'Please enter a description for this charge',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      // Get primary member for this account
      const primaryMember = members.find(m => m.member_type === 'primary');
      if (!primaryMember) {
        throw new Error('No primary member found for this account');
      }

      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          member_id: primaryMember.member_id,
          type: 'purchase',
          amount: -amount, // Negative amount for charges
          note: chargeDescription.trim(),
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      toast({
        title: 'Charge Added',
        description: `Successfully added $${amount.toFixed(2)} charge: ${chargeDescription}`,
        status: 'success',
        duration: 5000,
      });

      // Clear form
      setChargeAmount('');
      setChargeDescription('');

      // Refresh the ledger
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const ledgerResult = await res.json();
      setLedger(ledgerResult.data || []);
    } catch (error: any) {
      toast({
        title: 'Error Adding Charge',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
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

  // Handle reassign primary member
  const handleReassignPrimary = async (newPrimaryMemberId: string, memberName: string) => {
    if (!window.confirm(`Make ${memberName} the primary member? This will demote the current primary member.`)) {
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // First, demote current primary to secondary
      const { error: demoteError } = await supabase
        .from('members')
        .update({ member_type: 'secondary' })
        .eq('account_id', accountId)
        .eq('member_type', 'primary');

      if (demoteError) throw demoteError;

      // Then, promote new member to primary
      const { error: promoteError } = await supabase
        .from('members')
        .update({ member_type: 'primary' })
        .eq('member_id', newPrimaryMemberId);

      if (promoteError) throw promoteError;

      // Refresh members list
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', accountId)
        .eq('deactivated', false);

      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        if (a.member_type === 'primary' && b.member_type !== 'primary') return -1;
        if (a.member_type !== 'primary' && b.member_type === 'primary') return 1;
        return 0;
      });
      setMembers(sorted);

      toast({
        title: 'Primary Member Updated',
        description: `${memberName} is now the primary member`,
        status: 'success',
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reassign primary member',
        status: 'error',
        duration: 5000,
      });
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
        {/* Header with Back Button and Search */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => router.push('/admin/members')}
              className={styles.backButton}
            >
              ← Members
            </button>

            {/* Member Search */}
            <div style={{ position: 'relative', width: '500px' }}>
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => handleMemberSearch(e.target.value)}
                onFocus={() => memberSearchResults.length > 0 && setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                }}
              />

              {/* Search Results Dropdown */}
              {showSearchResults && memberSearchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 50,
                  }}
                >
                  {memberSearchResults.map((member) => (
                    <div
                      key={member.member_id}
                      onClick={() => {
                        router.push(`/admin/members/${member.account_id}`);
                        setMemberSearch('');
                        setShowSearchResults(false);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {member.first_name} {member.last_name}
                        {member.member_type === 'primary' && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontWeight: 400
                          }}>
                            (Primary)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                        {member.email || member.phone || 'No contact info'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.contentLayout}>
          <div className={styles.topRow}>
            <div className={styles.profileColumn}>
              {/* Member Cards */}
              <div className={styles.membersSection}>
                <div className={styles.membersSectionHeader}>
                  <h2 className={styles.sectionTitle}>Account Members ({members.length})</h2>
                  <button
                    onClick={() => setShowAddSecondaryModal(true)}
                    className={styles.addSecondaryButton}
                    title="Add Member ($25/month)"
                  >
                    + Add Member
                  </button>
                </div>
                <div className={styles.membersGrid}>
                  {members.map(member => (
                  <div key={member.member_id} className={styles.memberCard}>
                    {/* Member Header */}
                    <div className={styles.memberHeader} style={{ cursor: 'pointer' }} onClick={() => toggleMemberExpansion(member.member_id)}>
                      <div style={{ position: 'relative' }}>
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
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '5px',
                            right: '5px',
                            zIndex: 10
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PhotoCropUpload
                            currentPhoto={member.photo}
                            onPhotoSelected={(photoDataUrl) => handlePhotoUpdate(member.member_id, photoDataUrl)}
                            buttonClassName={styles.photoEditButton}
                            showEditButton={true}
                          />
                        </div>
                      </div>
                      <div className={styles.memberInfo}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <h3 className={styles.memberName}>
                            {member.first_name} {member.last_name}
                            {member.member_type === 'primary' && (
                              <span className={styles.primaryBadge}>Primary</span>
                            )}
                          </h3>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            style={{
                              transform: expandedMemberIds.has(member.member_id) ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              flexShrink: 0,
                              marginLeft: '0.5rem'
                            }}
                          >
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="#86868b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        {editingMemberId === member.member_id ? (
                          <div className={styles.memberDetailsInline} onClick={(e) => e.stopPropagation()}>
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
                                className={styles.saveIconButton}
                                title="Save Changes"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMemberId(null);
                                  setEditingMemberData({});
                                }}
                                className={styles.cancelIconButton}
                                title="Cancel"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                              {member.member_type !== 'primary' && (
                                <button
                                  onClick={() => handleReassignPrimary(member.member_id, `${member.first_name} ${member.last_name}`)}
                                  className={styles.makePrimaryEditButton}
                                  title="Make Primary Member"
                                >
                                  Make Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleSendLoginInfo(member.member_id)}
                                className={styles.sendLoginButton}
                                title="Send Login Info"
                                disabled={sendingLoginInfo || !member.phone}
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleArchiveMember(member.member_id, `${member.first_name} ${member.last_name}`)}
                                className={styles.archiveIconButton}
                                title="Archive Member"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                  <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
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
                              <div className={styles.detailRowWithAction}>
                                <div className={styles.detailRow}>
                                  <svg className={styles.detailIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                  </svg>
                                  <span>{formatDate(member.dob)}</span>
                                </div>
                                {editingMemberId !== member.member_id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
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
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {expandedMemberIds.has(member.member_id) && (
                      <>
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
                                className={styles.saveIconButton}
                                title="Save"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingAttributeId({ ...editingAttributeId, [member.member_id]: null })}
                                className={styles.cancelIconButton}
                                title="Cancel"
                              >
                                <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <div className={styles.attributeKey}>{attr.key}:</div>
                              <div className={styles.attributeValue}>{attr.value}</div>
                              <div className={styles.attributeActions}>
                                <button
                                  onClick={() => {
                                    setEditingAttributeId({ ...editingAttributeId, [member.member_id]: attr.id });
                                    setEditingAttributeData({
                                      ...editingAttributeData,
                                      [member.member_id]: { key: attr.key, value: attr.value }
                                    });
                                  }}
                                  className={styles.iconButton}
                                  title="Edit"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteAttribute(member.member_id, attr.id)}
                                  className={styles.deleteIconButton}
                                  title="Delete"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
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
                            <div className={styles.noteEditContainer}>
                              <textarea
                                className={styles.textarea}
                                value={editingNoteData[member.member_id] || ''}
                                onChange={(e) => setEditingNoteData({
                                  ...editingNoteData,
                                  [member.member_id]: e.target.value
                                })}
                              />
                              <div className={styles.noteEditActions}>
                                <button
                                  onClick={() => handleUpdateNote(member.member_id, note.id)}
                                  className={styles.saveIconButton}
                                  title="Save"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingNoteId({ ...editingNoteId, [member.member_id]: null })}
                                  className={styles.cancelIconButton}
                                  title="Cancel"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.noteContentWrapper}>
                              <div className={styles.noteTextContainer}>
                                <div className={styles.noteContent}>{note.note}</div>
                                <div className={styles.noteDate}>{formatDate(note.created_at)}</div>
                              </div>
                              <div className={styles.noteActions}>
                                <button
                                  onClick={() => {
                                    setEditingNoteId({ ...editingNoteId, [member.member_id]: note.id });
                                    setEditingNoteData({ ...editingNoteData, [member.member_id]: note.note });
                                  }}
                                  className={styles.iconButton}
                                  title="Edit"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(member.member_id, note.id)}
                                  className={styles.deleteIconButton}
                                  title="Delete"
                                >
                                  <svg className={styles.iconButtonIcon} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </div>
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
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className={styles.ledgerColumn}>
            {/* Subscription Card - Account-level subscription */}
            <MemberSubscriptionCard
              accountId={accountId as string}
              creditCardFeeEnabled={creditCardFeeEnabled}
              updatingFeeToggle={updatingFeeToggle}
              onToggleCreditCardFee={handleToggleCreditCardFee}
              totalLTV={members.reduce((sum, member) => sum + calculateMemberLTV(member.member_id), 0)}
            />

            {/* Quick Actions Card - Between Subscription and Ledger */}
            <div className={styles.ledgerActionsCard}>
                <button
                  className={styles.ledgerActionsHeader}
                  onClick={() => setIsLedgerActionsExpanded(!isLedgerActionsExpanded)}
                >
                  <span className={styles.ledgerActionsTitle}>Quick Actions</span>
                  <svg
                    className={`${styles.ledgerActionsChevron} ${isLedgerActionsExpanded ? styles.expanded : ''}`}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {isLedgerActionsExpanded && (
                  <div className={styles.ledgerActionsContent}>
                    {/* Charge Card */}
                    <div className={styles.actionSection}>
                      <h4 className={styles.actionTitle}>Charge Card</h4>
                      <div className={styles.actionForm}>
                        <input
                          type="number"
                          placeholder="$"
                          className={styles.actionInput}
                          value={customChargeAmount}
                          onChange={(e) => setCustomChargeAmount(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          className={styles.actionInput}
                          value={customChargeDescription}
                          onChange={(e) => setCustomChargeDescription(e.target.value)}
                        />
                        <button
                          onClick={handleCustomCharge}
                          disabled={isProcessingPayment || !customChargeAmount || !customChargeDescription}
                          className={styles.actionButton}
                          style={{ background: '#A59480' }}
                          aria-label="Charge card"
                        >
                          {isProcessingPayment ? '...' : '→'}
                        </button>
                      </div>
                    </div>

                    {/* Add Credit */}
                    <div className={styles.actionSection}>
                      <h4 className={styles.actionTitle}>Add Credit</h4>
                      <div className={styles.actionForm}>
                        <input
                          type="number"
                          placeholder="$"
                          className={styles.actionInput}
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          className={styles.actionInput}
                          value={creditDescription}
                          onChange={(e) => setCreditDescription(e.target.value)}
                        />
                        <button
                          onClick={handleAddCredit}
                          disabled={!creditAmount || !creditDescription}
                          className={styles.actionButton}
                          style={{ background: '#34C759' }}
                          aria-label="Add credit"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Add Purchase */}
                    <div className={styles.actionSection}>
                      <h4 className={styles.actionTitle}>Add Purchase</h4>
                      <div className={styles.actionForm}>
                        <input
                          type="number"
                          placeholder="$"
                          className={styles.actionInput}
                          value={chargeAmount}
                          onChange={(e) => setChargeAmount(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          className={styles.actionInput}
                          value={chargeDescription}
                          onChange={(e) => setChargeDescription(e.target.value)}
                        />
                        <button
                          onClick={handleAddCharge}
                          disabled={!chargeAmount || !chargeDescription}
                          className={styles.actionButton}
                          style={{ background: '#FF3B30' }}
                          aria-label="Add purchase"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Ledger Section */}
            <div className={styles.ledgerSection}>
              <div className={styles.ledgerHeader}>
                <h2 className={styles.sectionTitle}>Account Ledger</h2>
                <div className={styles.ledgerHeaderActions}>
                  {!ledgerLoading && ledger.length > 0 && (
                    <>
                      <div className={`${styles.currentBalance} ${calculateRunningBalance(ledger, ledger.length - 1) < 0 ? styles.balance : styles.credit}`}>
                        {calculateRunningBalance(ledger, ledger.length - 1) < 0 ? 'BALANCE' : 'CREDIT'}: {formatCurrency(Math.abs(calculateRunningBalance(ledger, ledger.length - 1)))}
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
                </div>
              </div>

              {ledgerLoading ? (
                <div className={styles.sectionLoading}>
                  <Spinner size="md" />
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
                    const isExpanded = expandedTransactionId === tx.id || isEditing;

                    return (
                      <div key={tx.id} className={styles.ledgerRow}>
                        <div
                          className={styles.ledgerRowContent}
                          onClick={() => {
                            if (!isEditing) {
                              setExpandedTransactionId(isExpanded ? null : tx.id);
                            }
                          }}
                          style={{ cursor: isEditing ? 'default' : 'pointer' }}
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
                                {transactionAttachments[tx.id]?.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const attachment = transactionAttachments[tx.id][0];
                                      window.open(attachment.file_url, '_blank');
                                    }}
                                    className={styles.downloadButton}
                                    title="Download receipt"
                                  >
                                    📎
                                  </button>
                                )}
                                <div className={styles.ledgerRowRight}>
                                  <div className={`${styles.ledgerAmount} ${tx.amount < 0 ? styles.negative : styles.positive}`}>
                                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className={styles.ledgerRowDetails} onClick={(e) => e.stopPropagation()}>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Date:</span>
                                  {isEditing ? (
                                    <input
                                      type="date"
                                      className={styles.compactInput}
                                      value={editingTransactionData.date || ''}
                                      onChange={(e) => setEditingTransactionData({ ...editingTransactionData, date: e.target.value })}
                                    />
                                  ) : (
                                    <span>{formatLedgerDate(tx.date)}</span>
                                  )}
                                </div>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Member:</span>
                                  <span>{txMember ? `${txMember.first_name} ${txMember.last_name}` : 'Unknown'}</span>
                                </div>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Type:</span>
                                  {isEditing ? (
                                    <select
                                      className={styles.compactSelect}
                                      value={editingTransactionData.type || ''}
                                      onChange={(e) => setEditingTransactionData({ ...editingTransactionData, type: e.target.value as 'payment' | 'purchase' })}
                                    >
                                      <option value="payment">Payment</option>
                                      <option value="purchase">Purchase</option>
                                    </select>
                                  ) : (
                                    <span>{tx.type === 'payment' ? 'Payment' : 'Purchase'}</span>
                                  )}
                                </div>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Amount:</span>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      className={styles.compactInput}
                                      value={Math.abs(editingTransactionData.amount || 0)}
                                      onChange={(e) => setEditingTransactionData({ ...editingTransactionData, amount: parseFloat(e.target.value) })}
                                      step="0.01"
                                    />
                                  ) : (
                                    <span>{formatCurrency(tx.amount)}</span>
                                  )}
                                </div>
                                <div className={styles.ledgerDetailRow}>
                                  <span className={styles.ledgerDetailLabel}>Note:</span>
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      placeholder="Note"
                                      className={styles.compactInput}
                                      value={editingTransactionData.note || ''}
                                      onChange={(e) => setEditingTransactionData({ ...editingTransactionData, note: e.target.value })}
                                    />
                                  ) : (
                                    <span>{tx.note || '—'}</span>
                                  )}
                                </div>
                                <div className={styles.ledgerRowActions}>
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => handleUpdateTransaction(tx.id)} className={styles.smallButton} title="Save">
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingTransactionId(null);
                                          setEditingTransactionData({});
                                        }}
                                        className={styles.smallButton}
                                        title="Cancel"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingTransactionId(tx.id);
                                          setEditingTransactionData(tx);
                                        }}
                                        className={styles.smallButton}
                                        title="Edit"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (window.confirm('Are you sure you want to delete this transaction?')) {
                                            handleDeleteTransaction(tx.id);
                                          }
                                        }}
                                        className={styles.smallButton}
                                        title="Delete"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                                <InlineAttachments
                                  ledgerId={tx.id}
                                  memberId={tx.member_id}
                                  accountId={accountId as string}
                                />
                              </div>
                            )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
              )}
            </div>

            {/* Messages Section */}
            <div className={styles.messagesSection}>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Messages</h2>
              </div>
              {messagesLoading ? (
                <div className={styles.sectionLoading}>
                  <Spinner size="md" />
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
      </div>

      {/* Add Secondary Member Modal */}
      {showAddSecondaryModal && (
        <AddSecondaryMemberModal
          accountId={accountId as string}
          onClose={() => setShowAddSecondaryModal(false)}
          onSuccess={() => {
            // Refresh members list
            const fetchMembers = async () => {
              try {
                const supabase = getSupabaseClient();
                const { data, error } = await supabase
                  .from('members')
                  .select('*')
                  .eq('account_id', accountId)
                  .eq('deactivated', false);

                if (error) throw error;

                const sorted = (data || []).sort((a, b) => {
                  if (a.member_type === 'primary' && b.member_type !== 'primary') return -1;
                  if (a.member_type !== 'primary' && b.member_type === 'primary') return 1;
                  return 0;
                });
                setMembers(sorted);
              } catch (err: any) {
                console.error('Error refreshing members:', err);
              }
            };
            fetchMembers();
          }}
        />
      )}
    </AdminLayout>
  );
}
