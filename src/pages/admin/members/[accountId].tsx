import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { Box, Spinner, Text, Button, SimpleGrid, VStack, Heading, HStack, Input, useToast, Flex, Switch, Select, FormControl, FormLabel, Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, IconButton } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { getSupabaseClient } from "../../api/supabaseClient";
import MemberDetail from "../../../components/MemberDetail";
// @ts-ignore
const MemberLedger = require("../../../components/pages/MemberLedger").default;
import AddMemberModal from '../../../components/members/AddMemberModal';
import SendMessageForm from '../../../components/messages/SendMessageForm';
import AdminLayout from '../../../components/layouts/AdminLayout';
import styles from '../../../styles/MemberDetailMobile.module.css';
import MobileAttachmentViewer from '../../../components/MobileAttachmentViewer';
import MobileSendMessageForm from '../../../components/MobileSendMessageForm';

import { EmailIcon, PhoneIcon, CalendarIcon } from "@chakra-ui/icons";
import { FaBriefcase, FaUser } from 'react-icons/fa';

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
  members?: {
    first_name: string;
    last_name: string;
    phone_number: string;
  };
}

interface Attribute {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

interface Note { id: string; note: string; created_at: string; }

function sortMembers(members: any[]) {
  return [...members].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return 0;
  });
}

export default function MemberDetailAdmin() {
  const router = useRouter();
  const { accountId } = router.query;
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<any>({});
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTransactionForm, setEditTransactionForm] = useState<any>({});
  const [selectedTransactionMemberId, setSelectedTransactionMemberId] = useState<string>('');
  const toast = useToast();
  const [memberAttributes, setMemberAttributes] = useState<Record<string, Attribute[]>>({});
  const [attrInputs, setAttrInputs] = useState<Record<string, { type: string; value: string }>>({});
  const [editingAttr, setEditingAttr] = useState<Record<string, { id: string | null; type: string; value: string }>>({});
  const [attrNotesHeights, setAttrNotesHeights] = useState<Record<string, number>>({});
  const [maxAttrNotesHeight, setMaxAttrNotesHeight] = useState<number>(0);
  const attrNotesRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingDelete, setPendingDelete] = useState<Record<string, string | null>>({});
  const [confirmingDelete, setConfirmingDelete] = useState<Record<string, string | null>>({});
  const [memberNotes, setMemberNotes] = useState<Record<string, Note[]>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<Record<string, { id: string | null; note: string }>>({});
  const [pendingDeleteNote, setPendingDeleteNote] = useState<Record<string, string | null>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [isEditingMember, setIsEditingMember] = useState<string | null>(null);
  const [editMemberData, setEditMemberData] = useState<Member | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState(false);
  const [isTextPdfModalOpen, setIsTextPdfModalOpen] = useState(false);
  const [selectedMemberForPdf, setSelectedMemberForPdf] = useState<Member | null>(null);
  const [pdfDateRange, setPdfDateRange] = useState('current_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sendingPdf, setSendingPdf] = useState(false);
  const [previousPeriodStart, setPreviousPeriodStart] = useState<string | null>(null);
  const [previousPeriodEnd, setPreviousPeriodEnd] = useState<string | null>(null);

  async function fetchMembers() {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('account_id', accountId)
        .eq('deactivated', false);
      if (error) throw error;
      setMembers(sortMembers(data || []));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accountId) return;
    fetchMembers();
  }, [accountId]);

  const fetchLedger = async (accountId: string) => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setLedger(result.data || []);
    } catch (err) {
      console.error('Ledger fetch error:', err);
      toast({
        title: 'Error fetching ledger',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (!accountId) return;
    fetchLedger(accountId as string);
  }, [accountId]);

  const handleAddTransaction = async (memberId: string, accountId: string) => {
    if (!newTransaction.type || !newTransaction.amount) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setTransactionStatus('loading');
    try {
      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: memberId,
          account_id: accountId,
          type: newTransaction.type,
          amount: newTransaction.amount,
          note: newTransaction.note,
          date: newTransaction.date || new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Clear the form
      setNewTransaction({});
      setSelectedTransactionMemberId('');
      
      // Refresh the ledger
      await fetchLedger(accountId);

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
        duration: 3000,
      });
    } finally {
      setTransactionStatus('');
    }
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransactionForm({
      note: transaction.note,
      amount: Math.abs(transaction.amount),
      type: transaction.type,
      date: transaction.date,
    });
  };

  const handleUpdateTransaction = async (tx: { id: string; type: string; amount: number; note?: string; date?: string }) => {
    const { id, type, amount, note, date } = tx;
    let amt = amount;
    if (type === 'purchase') amt = -Math.abs(amount);
    try {
      const response = await fetch('/api/ledger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, amount: amt, note, date }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setEditingTransaction(null);
      setEditTransactionForm({});
      await fetchLedger(accountId as string);
      toast({ title: 'Transaction updated', status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: 'Error updating transaction', description: err.message, status: 'error', duration: 3000 });
    }
  };
  const handleDeleteTransaction = async (id: string) => {
    try {
      const response = await fetch('/api/ledger', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      await fetchLedger(accountId as string);
      toast({ title: 'Transaction deleted', status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: 'Error deleting transaction', description: err.message, status: 'error', duration: 3000 });
    }
  };

  useEffect(() => {
    if (!accountId) return;
    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/messages?account_id=${accountId}`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setMessages(result.messages || []);
      } catch (err) {
        console.error('Messages fetch error:', err);
        toast({
          title: 'Error fetching messages',
          description: err instanceof Error ? err.message : 'Failed to fetch messages',
          status: 'error',
          duration: 5000,
        });
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    }
    fetchMessages();
  }, [accountId, toast]);

  useEffect(() => {
    if (!members.length) return;
    const newHeights: Record<string, number> = {};
    members.forEach(member => {
      const el = attrNotesRefs.current[member.member_id];
      if (el) newHeights[member.member_id] = el.offsetHeight;
    });
    setAttrNotesHeights(newHeights);
  }, [memberAttributes, members]);

  useEffect(() => {
    if (!members.length) return;
    const fetchAll = async () => {
      const newAttrs: Record<string, Attribute[]> = {};
      for (const member of members) {
        const res = await fetch(`/api/member_attributes?member_id=${member.member_id}`);
        const result = await res.json();
        newAttrs[member.member_id] = result.data || [];
      }
      setMemberAttributes(newAttrs);
    };
    fetchAll();
  }, [members]);

  const handleAddAttribute = async (member_id: string) => {
    const input = attrInputs[member_id] || { type: '', value: '' };
    if (!input.type) {
      toast({ title: 'Attribute type required', status: 'error', duration: 2000 });
      return;
    }
    const res = await fetch('/api/member_attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, key: input.type, value: input.value }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error adding attribute', description: result.error, status: 'error', duration: 3000 });
    } else {
      setAttrInputs(inputs => ({ ...inputs, [member_id]: { type: '', value: '' } }));
      setMemberAttributes(attrs => ({ ...attrs, [member_id]: result.data || [] }));
      toast({ title: 'Attribute added', status: 'success', duration: 2000 });
    }
  };

  const handleEditClick = (member_id: string, attr: Attribute) => {
    setEditingAttr(editing => ({ ...editing, [member_id]: { id: attr.id, type: attr.key, value: attr.value } }));
  };

  const handleSaveEdit = async (member_id: string) => {
    const edit = editingAttr[member_id];
    if (!edit || !edit.type) {
      toast({ title: 'Attribute type required', status: 'error', duration: 2000 });
      return;
    }
    try {
      const res = await fetch('/api/member_attributes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: edit.id, member_id, key: edit.type, value: edit.value }),
      });
      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setEditingAttr(editing => ({ ...editing, [member_id]: { id: null, type: '', value: '' } }));
      setConfirmingDelete(prev => ({ ...prev, [member_id]: null }));

      // Refetch attributes
      const refreshed = await fetch(`/api/member_attributes?member_id=${member_id}`);
      const refreshedResult = await refreshed.json();
      setMemberAttributes(attrs => ({ ...attrs, [member_id]: refreshedResult.data || [] }));

      toast({ title: 'Attribute updated', status: 'success', duration: 2000 });
    } catch (err: any) {
      console.error("Error saving attribute:", err);
      toast({ title: 'Error saving attribute', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleCancelEdit = (member_id: string) => {
    setEditingAttr(editing => ({ ...editing, [member_id]: { id: null, type: '', value: '' } }));
    setConfirmingDelete(prev => ({ ...prev, [member_id]: null }));
  };

  const handleDeleteAttribute = async (member_id: string) => {
    const edit = editingAttr[member_id];
    if (!edit || !edit.id) return;
    // No confirm dialog here; handled by two-step button
    const res = await fetch('/api/member_attributes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: edit.id }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error deleting attribute', description: result.error, status: 'error', duration: 3000 });
    } else {
      setEditingAttr(editing => ({ ...editing, [member_id]: { id: null, type: '', value: '' } }));
      // Immediately refresh the attributes list for this member
      const res2 = await fetch(`/api/member_attributes?member_id=${member_id}`);
      const result2 = await res2.json();
      setMemberAttributes(attrs => ({ ...attrs, [member_id]: result2.data || [] }));
      toast({ title: 'Attribute deleted', status: 'success', duration: 2000 });
    }
    setConfirmingDelete(prev => ({ ...prev, [member_id]: null }));
  };

  // After each render, update the max height
  useEffect(() => {
    const heights = Object.values(attrNotesHeights);
    if (heights.length > 0) {
      setMaxAttrNotesHeight(Math.max(...heights));
    }
  }, [attrNotesHeights, members]);

  function formatPhone(phone?: string) {
    if (!phone) return '';
    // Always use last 10 digits, and always return (123) 456-7890 format if possible
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  useEffect(() => {
    if (!members.length) return;
    const fetchAllNotes = async () => {
      const newNotes: Record<string, Note[]> = {};
      for (const member of members) {
        const res = await fetch(`/api/member_notes?member_id=${member.member_id}`);
        const result = await res.json();
        newNotes[member.member_id] = result.data || [];
      }
      setMemberNotes(newNotes);
    };
    fetchAllNotes();
  }, [members]);

  const handleAddNote = async (member_id: string) => {
    const note = noteInputs[member_id] || '';
    if (!note.trim()) {
      toast({ title: 'Note required', status: 'error', duration: 2000 });
      return;
    }
    const res = await fetch('/api/member_notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, note }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error adding note', description: result.error, status: 'error', duration: 3000 });
    } else {
      setNoteInputs(inputs => ({ ...inputs, [member_id]: '' }));
      setMemberNotes(notes => ({ ...notes, [member_id]: result.data || [] }));
      toast({ title: 'Note added', status: 'success', duration: 2000 });
    }
  };

  const handleEditNoteClick = (member_id: string, note: Note) => {
    setEditingNote(editing => ({ ...editing, [member_id]: { id: note.id, note: note.note } }));
  };

  const handleSaveEditNote = async (member_id: string) => {
    const edit = editingNote[member_id];
    if (!edit || !edit.note.trim()) {
      toast({ title: 'Note required', status: 'error', duration: 2000 });
      return;
    }
    const res = await fetch('/api/member_notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: edit.id, member_id, note: edit.note }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error updating note', description: result.error, status: 'error', duration: 3000 });
    } else {
      setEditingNote(editing => ({ ...editing, [member_id]: { id: null, note: '' } }));
      setMemberNotes(notes => ({ ...notes, [member_id]: result.data || [] }));
      toast({ title: 'Note updated', status: 'success', duration: 2000 });
    }
  };

  const handleCancelEditNote = (member_id: string) => {
    setEditingNote(editing => ({ ...editing, [member_id]: { id: null, note: '' } }));
  };

  const handleDeleteNote = async (member_id: string) => {
    const edit = editingNote[member_id];
    if (!edit || !edit.id) return;
    if (pendingDeleteNote[member_id] !== edit.id) {
      setPendingDeleteNote(pd => ({ ...pd, [member_id]: edit.id }));
      return;
    }
    const res = await fetch('/api/member_notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: edit.id, member_id }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error deleting note', description: result.error, status: 'error', duration: 3000 });
    } else {
      setEditingNote(editing => ({ ...editing, [member_id]: { id: null, note: '' } }));
      setPendingDeleteNote(pd => ({ ...pd, [member_id]: null }));
      setMemberNotes(notes => ({ ...notes, [member_id]: result.data || [] }));
      toast({ title: 'Note deleted', status: 'success', duration: 2000 });
    }
  };

  const handleCancelDeleteNote = (member_id: string) => {
    setPendingDeleteNote(pd => ({ ...pd, [member_id]: null }));
  };

  // Edit handler
  const handleEditMember = (member: Member) => {
    setEditMember(member);
    setIsEditModalOpen(true);
  };

  // Save handler for edit
  const handleSaveEditMember = async (memberData: any) => {
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member');
      }
      await fetchMembers();
      setIsEditModalOpen(false);
      setEditMember(null);
      toast({ title: 'Member updated', status: 'success', duration: 3000 });
    } catch (error: any) {
      toast({ title: 'Error updating member', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const handleInlineEditClick = (member: Member) => {
    setEditMemberData({ ...member });
    setIsEditingMember(member.member_id);
  };

  const handleInlineSaveEdit = async (memberId: string) => {
    if (!editMemberData) return;
    
    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMemberData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member');
      }
      
      await fetchMembers();
      setIsEditingMember(null);
      setEditMemberData(null);
      toast({ title: 'Member updated', status: 'success', duration: 3000 });
    } catch (error: any) {
      toast({ title: 'Error updating member', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const handleInlineCancelEdit = () => {
    setIsEditingMember(null);
    setEditMemberData(null);
  };

  const handleInlineEditChange = (field: string, value: string) => {
    if (!editMemberData) return;
    setEditMemberData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleDeleteMember = async (member: Member) => {
    if (!deleteConfirmMode) {
      // First click - show confirmation
      setDeleteConfirmMode(true);
      return;
    }

    // Second click - actually deactivate
    try {
      const response = await fetch(`/api/members/${member.member_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deactivate member');
      }
      
      await fetchMembers();
      setDeleteConfirmMode(false);
      toast({ title: 'Member deactivated', status: 'success', duration: 3000 });
      
      // If this was the last member, redirect to members list
      if (members.length <= 1) {
        router.push('/admin/members');
      }
    } catch (error: any) {
      toast({ title: 'Error deactivating member', description: error.message, status: 'error', duration: 3000 });
    }
  };

  // Calculate previous membership period based on join date
  useEffect(() => {
    const calculatePreviousPeriod = () => {
      if (!selectedMemberForPdf?.join_date) {
        console.log('No member selected or no join date available');
        setPreviousPeriodStart(null);
        setPreviousPeriodEnd(null);
        return;
      }

      const today = new Date();
      const joinDate = new Date(selectedMemberForPdf.join_date);
      
      console.log('Today:', today.toISOString().split('T')[0]);
      console.log('Join date:', joinDate.toISOString().split('T')[0]);
      
      // Calculate how many months have passed since join date
      const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                             (today.getMonth() - joinDate.getMonth());
      
      console.log('Months since join:', monthsSinceJoin);
      
      if (monthsSinceJoin < 1) {
        // Member joined less than a month ago, no previous period
        console.log('Member joined less than a month ago, no previous period');
        setPreviousPeriodStart(null);
        setPreviousPeriodEnd(null);
        return;
      }
      
      // Calculate the end of the previous membership period
      // This would be the day before the current period started
      const previousPeriodEnd = new Date(joinDate);
      previousPeriodEnd.setMonth(joinDate.getMonth() + monthsSinceJoin);
      previousPeriodEnd.setDate(joinDate.getDate() - 1); // Day before current period
      
      // Calculate the start of the previous membership period
      const previousPeriodStart = new Date(joinDate);
      previousPeriodStart.setMonth(joinDate.getMonth() + monthsSinceJoin - 1);
      previousPeriodStart.setDate(joinDate.getDate());
      
      console.log('Previous period start:', previousPeriodStart.toISOString().split('T')[0]);
      console.log('Previous period end:', previousPeriodEnd.toISOString().split('T')[0]);
      
      setPreviousPeriodStart(previousPeriodStart.toISOString().split('T')[0]);
      setPreviousPeriodEnd(previousPeriodEnd.toISOString().split('T')[0]);
    };
    
    if (isTextPdfModalOpen) calculatePreviousPeriod();
  }, [selectedMemberForPdf, isTextPdfModalOpen]);

  // Update handleTextPdf to support previous membership period
  const handleTextPdf = async () => {
    if (!selectedMemberForPdf) {
      toast({
        title: 'Error',
        description: 'Please select a member to send the PDF to.',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    // Handle sending to both members
    if (selectedMemberForPdf.member_id === 'both') {
      const membersWithPhone = members.filter(m => m.phone);
      if (membersWithPhone.length === 0) {
        toast({
          title: 'Error',
          description: 'No members have valid phone numbers.',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      
      try {
        setSendingPdf(true);
        let startDate, endDate;
        const today = new Date();
        switch (pdfDateRange) {
          case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
          case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
          case 'last_3_months':
            startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
          case 'previous_membership_period':
            if (!previousPeriodStart || !previousPeriodEnd) {
              toast({ title: 'Error', description: 'No previous membership period found.', status: 'error', duration: 3000 });
              setSendingPdf(false);
              return;
            }
            startDate = new Date(previousPeriodStart);
            endDate = new Date(new Date(previousPeriodEnd).getTime() - 86400000);
            break;
          case 'custom':
            if (!customStartDate || !customEndDate) {
              toast({ title: 'Error', description: 'Please select both start and end dates.', status: 'error', duration: 3000 });
              setSendingPdf(false);
              return;
            }
            startDate = new Date(customStartDate);
            endDate = new Date(customEndDate);
            break;
          default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        
        // Send to all members with phone numbers
        const sendPromises = membersWithPhone.map(async (member) => {
          const response = await fetch('/api/send-ledger-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              member_id: member.member_id,
              account_id: member.account_id,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              phone: member.phone,
              member_name: `${member.first_name} ${member.last_name}`
            }),
          });
          return { member, response };
        });
        
        const results = await Promise.all(sendPromises);
        const successfulSends = results.filter(r => r.response.ok);
        const failedSends = results.filter(r => !r.response.ok);
        
        if (successfulSends.length > 0) {
          toast({
            title: 'PDFs Sent!',
            description: `Ledger PDF has been sent to ${successfulSends.length} member(s)`,
            status: 'success',
            duration: 5000,
          });
        }
        
        if (failedSends.length > 0) {
          toast({
            title: 'Partial Error',
            description: `Failed to send PDF to ${failedSends.length} member(s)`,
            status: 'warning',
            duration: 5000,
          });
        }
        
        setIsTextPdfModalOpen(false);
        setSelectedMemberForPdf(null);
        setPdfDateRange('current_month');
        setCustomStartDate('');
        setCustomEndDate('');
      } catch (error: any) {
        console.error('Error sending PDFs:', error);
        toast({ title: 'Error', description: error.message || 'Failed to send PDFs', status: 'error', duration: 3000 });
      } finally {
        setSendingPdf(false);
      }
      return;
    }
    
    if (!selectedMemberForPdf.phone) {
      toast({
        title: 'Error',
        description: 'The selected member does not have a valid phone number.',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    try {
      setSendingPdf(true);
      let startDate, endDate;
      const today = new Date();
      switch (pdfDateRange) {
        case 'current_month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case 'last_month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        case 'last_3_months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case 'previous_membership_period':
          console.log('Previous membership period selected');
          console.log('previousPeriodStart:', previousPeriodStart);
          console.log('previousPeriodEnd:', previousPeriodEnd);
          if (!previousPeriodStart || !previousPeriodEnd) {
            toast({ title: 'Error', description: 'No previous membership period found.', status: 'error', duration: 3000 });
            setSendingPdf(false);
            return;
          }
          startDate = new Date(previousPeriodStart);
          endDate = new Date(new Date(previousPeriodEnd).getTime() - 86400000); // day before last renewal
          console.log('Calculated dates:', startDate, endDate);
          break;
        case 'custom':
          if (!customStartDate || !customEndDate) {
            toast({ title: 'Error', description: 'Please select both start and end dates.', status: 'error', duration: 3000 });
            setSendingPdf(false);
            return;
          }
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          break;
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }
      const response = await fetch('/api/send-ledger-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMemberForPdf.member_id,
          account_id: selectedMemberForPdf.account_id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          phone: selectedMemberForPdf.phone,
          member_name: `${selectedMemberForPdf.first_name} ${selectedMemberForPdf.last_name}`
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send PDF');
      }
      toast({
        title: 'PDF Sent!',
        description: `Ledger PDF has been sent to ${selectedMemberForPdf.first_name} ${selectedMemberForPdf.last_name}`,
        status: 'success',
        duration: 5000,
      });
      setIsTextPdfModalOpen(false);
      setSelectedMemberForPdf(null);
      setPdfDateRange('current_month');
      setCustomStartDate('');
      setCustomEndDate('');
    } catch (error: any) {
      console.error('Error sending PDF:', error);
      toast({ title: 'Error', description: error.message || 'Failed to send PDF', status: 'error', duration: 3000 });
    } finally {
      setSendingPdf(false);
    }
  };

  if (loading) {
    return <Box p={8} display="flex" justifyContent="center"><Spinner size="xl" /></Box>;
  }
  if (error) {
    return <Box p={8}><Text color="red.500">Error: {error}</Text></Box>;
  }
  if (!members.length) {
    return <Box p={8}><Text>No members found for this account.</Text></Box>;
  }

  // Remove hasPreviousMembershipPeriod state and logic
  // Instead, compute showPreviousMembershipPeriod based on join_date
  const showPreviousMembershipPeriod = selectedMemberForPdf?.join_date && (new Date().getTime() - new Date(selectedMemberForPdf.join_date).getTime() > 31 * 24 * 60 * 60 * 1000);

  return (
    <AdminLayout>
      {/* Desktop View - Unchanged */}
      <div className={styles.desktopView}>
        <Box p={8}>
        <HStack spacing={4} mb={6}>
          <Button 
            mb={6} 
            onClick={() => router.push('/admin/members')}
            bg="#A59480"
            color="white"
            borderRadius="12px"
            fontWeight="semibold"
            fontSize="md"
            _hover={{ bg: '#8B7B68' }}
          >
            Back to Members
          </Button>
          <Button 
            mb={6} 
            onClick={() => setAddMemberOpen(true)}
            bg="#A59480"
            color="white"
            borderRadius="12px"
            fontWeight="semibold"
            fontSize="md"
            _hover={{ bg: '#8B7B68' }}
          >
            Add New Member
          </Button>
          
        </HStack>
        <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setAddMemberOpen(false)} onSave={async (memberData: any) => {
          setAddMemberOpen(false);
        }} />
        <AddMemberModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setEditMember(null); }}
          onSave={handleSaveEditMember}
        />
        <SimpleGrid columns={2} spacing={8} mb={10} mt={120} minChildWidth="600px">
          {members.map(member => (
            <Box key={member.member_id} minH="540px" display="flex" flexDirection="column" alignItems="center" bg="transparent" borderRadius="16px" boxShadow="none" p={0} fontFamily="Montserrat, sans-serif" position="relative">
              {/* Profile Card Box */}
              <Box position="relative" bg="#a59480" borderRadius="16px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" p={15} pb="10%" pt="10%" w="100%" maxW="500px" display="flex" flexDirection="column" alignItems="center">
                {/* Photo as background, floating above card */}
                <Box
                  position="absolute"
                  top="-100px"
                  left="50%"
                  transform="translateX(-50%)"
                  zIndex={2}
                  borderRadius="100%"
                  border="2px solid white"
                  overflow="hidden"
                  width="35%"
                  height="35%"
                  boxShadow="0 2px 8px rgba(0,0,0,0.50)"
                  bg="#fff"
                >
                  {member.photo ? (
                    <img src={member.photo} alt={`${member.first_name} ${member.last_name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Box width="100%"  height="100%" display="flex" alignItems="bottom" justifyContent="bottom" bg="#F7FAFC" >
                      
                    </Box>
                  )}
                </Box>
                {/* Member Name */}
                <Box
                  position="relative"
                  zIndex={2}
                  top="2%"
                  mb={4}
                  textAlign="center"
                  width="100%"
                  mt={0}
                  
                >
                  <Text fontSize="200%" fontWeight="bold" color="#ecede8"  fontFamily="IvyJournal-Thin, serif" textTransform="uppercase" letterSpacing="0.08em" m={0} p={0}>
                    {member.first_name} {member.last_name}
                  </Text>
                </Box>
                {/* Info Box */}
                <Box bg="#ecede8" p={1} borderRadius="12px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" w="95%" mt={2} padding={10} position="relative">
                  <SimpleGrid columns={2} spacingX={10} spacingY={1} ml={0} w="100%" alignItems="start">
                    <VStack align="flex-start" spacing={1} ml={1}>
                      <HStack spacing={1} color="#353535" width="90%">
                        <PhoneIcon boxSize={10} />
                        {isEditingMember === member.member_id ? (
                          <Input
                            value={editMemberData?.phone || ''}
                            onChange={(e) => handleInlineEditChange('phone', e.target.value)}
                            size="sm"
                            fontSize="12px"
                            fontFamily="Montserrat, sans-serif"
                            bg="white"
                            border="1px solid #A59480"
                            borderRadius="4px"
                          />
                        ) : (
                          <Text fontSize="14px" margin={5}>{formatPhone(member.phone) || <span style={{ color: '#ccc' }}> </span>}</Text>
                        )}
                      </HStack>
                      <HStack spacing={1} color="#353535">
                        <EmailIcon boxSize={10} />
                        {isEditingMember === member.member_id ? (
                          <Input
                            value={editMemberData?.email || ''}
                            onChange={(e) => handleInlineEditChange('email', e.target.value)}
                            size="sm"
                            fontFamily="Montserrat, sans-serif"
                            fontSize="12px"
                            bg="white"
                            border="1px solid #A59480"
                            borderRadius="4px"
                          />
                        ) : (
                          <Text fontSize="14px" margin={5}>{member.email || <span style={{ color: '#ccc' }}> </span>}</Text>
                        )}
                      </HStack>
                      <HStack spacing={1} color="#353535">
                        <Box as={FaBriefcase} boxSize={10} />
                        {isEditingMember === member.member_id ? (
                          <Input
                            value={editMemberData?.company || ''}
                            onChange={(e) => handleInlineEditChange('company', e.target.value)}
                            size="sm"
                            fontSize="12px"
                            fontFamily="Montserrat, sans-serif"
                            bg="white"
                            border="1px solid #A59480"
                            borderRadius="4px"
                            placeholder="Company"
                          />
                        ) : (
                          <Text fontSize="14px" fontFamily="Montserrat, sans-serif" margin={5}>
                            Co.: {member.company || <span style={{ color: '#bbb' }}>—</span>}
                          </Text>
                        )}
                      </HStack>
                    </VStack>
                    <VStack align="flex-start" spacing={1} mr={2} width="100%">
                      {member.dob && (
                        <HStack spacing={1} color="#353535">
                          <CalendarIcon boxSize={10} />
                          {isEditingMember === member.member_id ? (
                            <Input
                              type="date"
                              value={editMemberData?.dob ? editMemberData.dob.slice(0, 10) : ''}
                              onChange={(e) => handleInlineEditChange('dob', e.target.value)}
                              size="sm"
                              fontFamily="Montserrat, sans-serif"
                              fontSize="12px"
                              bg="white"
                              border="1px solid #A59480"
                              borderRadius="4px"
                            />
                          ) : (
                            <Text fontSize="14px" fontFamily="Montserrat, sans-serif" margin={5}>
                              Birthdate: {new Date(member.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          )}
                        </HStack>
                      )}
                      {member.join_date && (
                        <HStack spacing={1} color="#353535">
                          <CalendarIcon boxSize={10} />
                          {isEditingMember === member.member_id ? (
                            <Input
                              type="date"
                              value={editMemberData?.join_date ? editMemberData.join_date.slice(0, 10) : ''}
                              onChange={(e) => handleInlineEditChange('join_date', e.target.value)}
                              size="sm"
                              fontFamily="Montserrat, sans-serif"
                              fontSize="12px"
                              bg="white"
                              border="1px solid #A59480"
                              borderRadius="4px"
                            />
                          ) : (
                            <Text fontSize="14px" fontFamily="Montserrat, sans-serif" margin={5}>Member Since: {new Date(member.join_date).toLocaleDateString()}</Text>
                          )}
                        </HStack>
                      )}
                      <HStack spacing={1} color="#353535">
                        <Box as={FaUser} boxSize={10} />
                        {isEditingMember === member.member_id ? (
                          <Input
                            value={editMemberData?.referred_by || ''}
                            onChange={(e) => handleInlineEditChange('referred_by', e.target.value)}
                            size="sm"
                            fontSize="12px"
                            fontFamily="Montserrat, sans-serif"
                            bg="white"
                            border="1px solid #A59480"
                            borderRadius="4px"
                            placeholder="Referred by"
                          />
                        ) : (
                          <Text fontSize="14px" fontFamily="Montserrat, sans-serif" margin={5}>Referred by: {member.referred_by || <span style={{ color: '#bbb' }}>—</span>}</Text>
                        )}
                      </HStack>
                      <HStack spacing={1} color="#353535">
                        <Box as={FaUser} boxSize={10} />
                        <HStack spacing={2} alignItems="center">
                          <Text fontSize="14px" fontFamily="Montserrat, sans-serif" margin={5}>
                            Ledger Notifications: 
                          </Text>
                          <Switch
                            isChecked={member.ledger_notifications_enabled !== false}
                            onChange={async (e) => {
                              try {
                                const { error } = await getSupabaseClient()
                                  .from('members')
                                  .update({ ledger_notifications_enabled: e.target.checked })
                                  .eq('member_id', member.member_id);
                                
                                if (error) throw error;
                                
                                // Update local state
                                setMembers(prev => prev.map(m => 
                                  m.member_id === member.member_id 
                                    ? { ...m, ledger_notifications_enabled: e.target.checked }
                                    : m
                                ));
                                
                                toast({
                                  title: 'Updated',
                                  description: `Ledger notifications ${e.target.checked ? 'enabled' : 'disabled'} for ${member.first_name}`,
                                  status: 'success',
                                  duration: 2000,
                                });
                              } catch (error) {
                                console.error('Error updating ledger notifications:', error);
                                toast({
                                  title: 'Error',
                                  description: 'Failed to update ledger notifications',
                                  status: 'error',
                                  duration: 3000,
                                });
                              }
                            }}
                            colorScheme="green"
                            size="sm"
                          />
                        </HStack>
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                  
                  {/* Edit/Save/Cancel Buttons */}
                  <Box position="absolute" bottom={4} right={4}>
                    {isEditingMember === member.member_id ? (
                      <HStack spacing={2}>
                        <Button
                          mb={6}
                          mr={6}
                          onClick={() => handleInlineSaveEdit(member.member_id)}
                          bg="#A59480"
                          color="white"
                          
                          borderRadius="12px"
                          fontWeight="semibold"
                          fontSize="md"
                          _hover={{ bg: '#8B7B68' }}
                        >
                          Save
                        </Button>
                        <Button
                          mb={6}
                          mr={6}
                          onClick={handleInlineCancelEdit}
                          bg="#A59480"
                          color="white"
                          borderRadius="12px"
                          fontWeight="semibold"
                          fontSize="md"
                          _hover={{ bg: '#8B7B68' }}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <Button
                        mb={6}
                        mr={6}
                        onClick={() => handleInlineEditClick(member)}
                        bg="#A59480"
                        color="white"
                        borderRadius="12px"
                        fontWeight="semibold"
                        fontSize="md"
                        _hover={{ bg: '#8B7B68' }}
                      >
                        Edit
                      </Button>
                    )}
                  </Box>
                </Box>
                {/* Add 10px space between info card and attributes card */}
                <Box h="10px" />
                {/* Centered Attributes & Notes title above the card */}
                <Box width="95%" textAlign="center" mb={2}>
                  <Text fontSize="24px" fontWeight="bold" color="#ecede8" fontFamily="IvyJournal-Thin, serif"  letterSpacing="0.08em" m={0} mb={0}>
                    Attributes & Notes
                  </Text>
                </Box>
              
                <Box bg="#ecede8" p={4} borderRadius="12px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" w="95%" mt={2} padding={10} mb={0}>
                  {/* Attributes Section */}
                  <Text fontFamily="Montserrat Bold, sans-serif" fontSize="14px" mb={2} color="#a59480">Attributes</Text>
                  {/* List attributes */}
                  <VStack align="stretch" margin={0} padding={0} ml={0} spacing={0} mb={0} w="100%">
                    {(memberAttributes[member.member_id] || []).map(attr => (
                      editingAttr[member.member_id]?.id === attr.id ? (
                        <Flex key={attr.id} align="center" gap={2} mb={2} width="100%">
                          <Input
                            value={editingAttr[member.member_id]?.type || ''}
                            onChange={e => setEditingAttr(editing => ({ ...editing, [member.member_id]: { ...editing[member.member_id], type: e.target.value } }))}
                            minW="120px"
                            w="30%"
                            bg="#ECEDE8"
                            border="2px solid #A59480"
                            borderRadius="8px"
                            fontSize="14px"
                            fontFamily="Montserrat, sans-serif"
                            
                            py={2}
                            px={3}
                            _placeholder={{ color: "#999" }}
                          />
                          <Input
                            value={editingAttr[member.member_id]?.value || ''}
                            onChange={e => setEditingAttr(editing => ({ ...editing, [member.member_id]: { ...editing[member.member_id], value: e.target.value } }))}
                            minW="140px"
                            w="50%"
                            bg="#ECEDE8"
                            border="2px solid #A59480"
                            borderRadius="8px"
                            fontSize="14px"
                            fontFamily="Montserrat, sans-serif"
                            
                            py={2}
                            px={3}
                            _placeholder={{ color: "#999" }}
                          />
                          <Button size="sm" colorScheme="green" fontSize="14px" minW="65px" borderRadius="8px" onClick={() => handleSaveEdit(member.member_id)}>Save</Button>
                          <Button size="sm" variant="ghost" minW="65px" borderRadius="8px" onClick={() => handleCancelEdit(member.member_id)}>Cancel</Button>
                          {confirmingDelete[member.member_id] === attr.id ? (
                            <Button
                              size="sm"
                              minW="80px"
                              backgroundColor="red"
                              color="white"
                              borderRadius="8px"
                              onClick={() => handleDeleteAttribute(member.member_id)}
                              _hover={{ bg: 'red.600' }}
                            >
                              Confirm
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              minW="80px"
                              backgroundColor=""
                              color="red"
                              borderRadius="8px"
                              onClick={() => setConfirmingDelete(prev => ({ ...prev, [member.member_id]: attr.id }))}
                              _hover={{ bg: 'red.600' }}
                            >
                              Delete
                            </Button>
                          )}
                        </Flex>
                      ) : (
                        <Flex key={attr.id} align="center" justify="space-between" mb={2} width="100%">
                          <Flex w="75%" gap={50}>
                            <Box minW="150px">
                              <Text fontWeight="semibold" color="#353535" fontSize="14px">{attr.key}</Text>
                            </Box>
                            <Box>
                              <Text fontSize="14px" color="#353535">{attr.value}</Text>
                            </Box>
                          </Flex>
                          <Button
                            size="sm"
                            backgroundColor="#A59480"
                            color="#ECEDE8"
                            fontFamily="Montserrat, sans-serif"
                            fontSize="14px"
                            borderRadius="6px"
                            px={4}
                            _hover={{ backgroundColor: '#8c7a68' }}
                            onClick={() => handleEditClick(member.member_id, attr)}
                          >
                            Edit
                          </Button>
                        </Flex>
                      )
                    ))}
                  </VStack>
                  <Flex align="center" gap={2} mb={4} width="100%">
                    <Input
                      placeholder="Attribute Type"
                      value={attrInputs[member.member_id]?.type || ''}
                      onChange={e => setAttrInputs(inputs => ({ ...inputs, [member.member_id]: { ...inputs[member.member_id], type: e.target.value } }))}
                      minW="120px"
                      w="30%"
                      bg="#ECEDE8"
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="14px"
                      fontFamily="Montserrat, sans-serif"
                      py={2}
                      px={3}
                      _placeholder={{ color: "#999" }}
                    />
                    <Input
                      placeholder="Attribute Detail"
                      value={attrInputs[member.member_id]?.value || ''}
                      onChange={e => setAttrInputs(inputs => ({ ...inputs, [member.member_id]: { ...inputs[member.member_id], value: e.target.value } }))}
                      minW="140px"
                      w="50%"
                      bg="#ECEDE8"
                      ml={10}
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="14px"
                      fontFamily="Montserrat, sans-serif"
                      py={2}
                      px={3}
                      _placeholder={{ color: "#999" }}
                    />
                    <Button bg="#A59480" color="white" borderRadius="8px" fontWeight="semibold" fontSize="md" ml={18} minW="80px" alignContent="right" _hover={{ bg: '#8B7B68' }} onClick={() => handleAddAttribute(member.member_id)}>Add</Button>
                  </Flex>
                  {/* Notes Section */}
                  <Text fontWeight="bold" fontFamily="Montserrat Bold, sans-serif" fontSize="14px" mb={2} color="#a59480">Notes History</Text>
                  <VStack align="stretch" spacing={2} w="100%">
                    {(memberNotes[member.member_id] || []).map(note => (
                      <Flex key={note.id} align="center" gap={2} mb={1} width="100%">
                        {editingNote[member.member_id]?.id === note.id ? (
                          <>
                            <Input
                              value={editingNote[member.member_id]?.note || ''}
                              onChange={e => setEditingNote(editing => ({ ...editing, [member.member_id]: { ...editing[member.member_id], note: e.target.value } }))}
                              minW="160px"
                              w="65%"
                              bg="#ECEDE8"
                              border="2px solid #A59480"
                              borderRadius="8px"
                              fontSize="14px"
                              fontFamily="Montserrat, sans-serif"
                              py={2}
                              px={3}
                              _placeholder={{ color: "#999" }}
                            />
                            <Button size="sm" colorScheme="green" minW="65px" fontSize="14px" borderRadius="8px" onClick={() => handleSaveEditNote(member.member_id)}>Save</Button>
                            <Button size="sm" variant="ghost" minW="65px" borderRadius="8px" onClick={() => handleCancelEditNote(member.member_id)}>Cancel</Button>
                            {pendingDeleteNote[member.member_id] === note.id ? (
                              <Button size="sm" backgroundColor="red" color="white"  minW="110px" borderRadius="8px" onClick={() => handleDeleteNote(member.member_id)}>Delete</Button>
                            ) : (
                              <Button size="sm" color="red" backgroundColor="white" minW="65px" borderRadius="8px" onClick={() => handleDeleteNote(member.member_id)}>Delete</Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Text minW="160px" w="65%" fontSize="14px">{note.note}</Text>
                            <Text fontSize="12px" color="#888" minW="140px">{
                              (() => {
                                const d = new Date(note.created_at);
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const dd = String(d.getDate()).padStart(2, '0');
                                const yy = String(d.getFullYear()).slice(-2);
                                const hh = String(d.getHours()).padStart(2, '0');
                                const min = String(d.getMinutes()).padStart(2, '0');
                                return `${mm}/${dd}/${yy} ${hh}:${min}`;
                              })()
                            }</Text>
                            <Button size="sm" minW="65px" borderRadius="8px" backgroundColor="#a59480" color="white" fontSize="14px" onClick={() => handleEditNoteClick(member.member_id, note)} colorScheme="yellow">Edit</Button>
                          </>
                        )}
                      </Flex>
                    ))}
                  </VStack>
                  <Flex align="center" gap={2} mb={4} width="100%">
                    <Input
                      placeholder="New note..."
                      value={noteInputs[member.member_id] || ''}
                      onChange={e => setNoteInputs(inputs => ({ ...inputs, [member.member_id]: e.target.value }))}
                      minW="160px"
                      w="100%"
                      flexGrow={1}
                      bg="#ECEDE8"
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="14px"
                      fontFamily="Montserrat, sans-serif"
                      py={2}
                      px={3}
                      _placeholder={{ color: "#999" }}
                    />
                    <Button
                      alignSelf="flex-start"
                      bg="#A59480"
                      color="white"
                      borderRadius="8px"
                      fontWeight="semibold"
                      fontSize="12"
                      
                      minW="80px"
                      _hover={{ bg: '#8B7B68' }}
                      onClick={() => handleAddNote(member.member_id)}
                      ml="20"
                    >
                      Add Note
                    </Button>
                  </Flex>
                </Box>
                <Box h={1} />
                {/* Member ID in bottom-right corner */}
                <Box position="absolute" bottom="12px" right="20px">
                  <Text fontSize="10px" fontStyle="italic" color="#ECEDE8" opacity={0.6}>
                    ID: {member.member_id}
                  </Text>
                </Box>
              </Box>
              {/* Other member info, attributes, etc. can go below here as needed */}
            </Box>
          ))}
        </SimpleGrid>
        <Box
          bg="white"
          borderRadius="24px"
          boxShadow="0 4px 16px rgba(53,53,53,0.5)"
          p={10}
          mb={10}
          ml={30}
          fontFamily="Montserrat, sans-serif"
          width="94%"
        >
          <HStack justify="space-between" align="center" mb={4}>
            <Heading
              fontSize="36px"
              fontWeight="bold"
              color="#353535"
              fontFamily="IvyJournal-Thin, serif"
              textTransform="uppercase"
              letterSpacing="0.08em"
              mb={0}
            >
              Ledger
            </Heading>
            <Button
              bg="#A59480"
              color="white"
              borderRadius="12px"
              fontWeight="semibold"
              fontSize="md"
              _hover={{ bg: '#8B7B68' }}
              onClick={() => {
                setIsTextPdfModalOpen(true);
              }}
            >
              📄 Text PDF
            </Button>
          </HStack>
          {ledgerLoading ? (
            <Spinner size="md" />
          ) : (
            <Box margin={0} width="94%" marginLeft="2%" dropShadow="0 4px 16px rgba(53,53,53,0.5)" overflowX="auto">
              <MemberLedger
                members={members as any}
                memberLedger={ledger}
                selectedMember={members[0]}
                ledgerLoading={ledgerLoading}
                newTransaction={newTransaction}
                setNewTransaction={setNewTransaction}
                handleAddTransaction={handleAddTransaction}
                transactionStatus={transactionStatus}
                editingTransaction={editingTransaction}
                setEditingTransaction={setEditingTransaction}
                editTransactionForm={editTransactionForm}
                setEditTransactionForm={setEditTransactionForm}
                handleEditTransaction={handleEditTransaction}
                handleUpdateTransaction={handleUpdateTransaction}
                handleDeleteTransaction={handleDeleteTransaction}
                fetchLedger={() => accountId && fetchLedger(accountId as string)}
                setSelectedTransactionMemberId={setSelectedTransactionMemberId}
                selectedTransactionMemberId={selectedTransactionMemberId}
                session={null}
              />
            </Box>
          )}
        </Box>
        

        
        {/* Message + History Card */}
        <Box bg="white" border="3px solid #a59480" borderRadius="16px" width="94%" marginLeft="2%" boxShadow="lg" p={8} mb={8} paddingTop={20}> 
          
          <Box display={{ base: 'block', md: 'flex' }} gap={16} paddingBottom={10}>
            {/* Send Message Form */}
            <Box flex={10} width="50%" marginLeft="25%" mr={{ md: 6 }}>
              <SendMessageForm
                members={members as any}
                accountId={accountId as string}
                onSent={async () => {
                  // Refetch messages after sending
                }}
              />
            </Box>
            {/* Message History Table */}
            <Box flex={1} minW={0}>
              <Heading size="sm" >Message History</Heading>
              {messagesLoading ? (
                <Spinner size="md" />
              ) : messages.length === 0 ? (
                <Text>No messages found for this account.</Text>
              ) : (
                <Box overflowX="auto">
                  <table style={{ width: '90%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Message</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>To</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((msg: any) => {
                        // Find the member name for this message
                        const member = members.find(m => m.member_id === msg.member_id);
                        const memberName = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
                        
                        return (
                          <tr key={msg.id}>
                            <td style={{ padding: '8px', width: '60%', borderBottom: '1px solid #f0f0f0' }}>{msg.content}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{new Date(msg.timestamp).toLocaleString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric'
                            })}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{memberName}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{msg.sent_by || 'System'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
        {/* Delete Member Button - Two Stage */}
        <Box 
          display="flex" 
          justifyContent="center" 
          mt={8} 
          pb={8}
          borderTop="1px solid"
          borderColor="gray.200"
          pt={6}
        >
          <Button
            onClick={() => handleDeleteMember(members[0])}
            bg={deleteConfirmMode ? "red.600" : "red.500"}
            color="#545454"
            borderRadius="8px"
            fontWeight="normal"
            fontSize="sm"
            size="sm"
            opacity={0.7}
            _hover={{ bg: deleteConfirmMode ? 'red.700' : 'red.600', opacity: 1 }}
            _active={{ bg: 'red.700' }}
          >
            {deleteConfirmMode ? "CONFIRM DELETE MEMBER - THIS CANNOT BE UNDONE" : "Delete Member"}
          </Button>
        </Box>

        {/* Text PDF Drawer */}
        <Drawer 
          isOpen={isTextPdfModalOpen} 
          placement="right" 
          onClose={() => {
            setIsTextPdfModalOpen(false);
            setSelectedMemberForPdf(null);
            setPdfDateRange('current_month');
            setCustomStartDate('');
            setCustomEndDate('');
          }} 
          size="sm"
          closeOnOverlayClick={true}
          closeOnEsc={true}
        >
          <Box zIndex="2000" position="relative">
            <DrawerOverlay bg="blackAlpha.600" onClick={() => {
              setIsTextPdfModalOpen(false);
              setSelectedMemberForPdf(null);
              setPdfDateRange('current_month');
              setCustomStartDate('');
              setCustomEndDate('');
            }} />
                    <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="400px" 
          w="40vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          style={{
            transform: isTextPdfModalOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
              <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
                Send Ledger PDF via SMS
              </DrawerHeader>
              <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Select Member</FormLabel>
                    <Select
                      value={selectedMemberForPdf?.member_id || ''}
                      onChange={(e) => {
                        if (e.target.value === 'both') {
                          setSelectedMemberForPdf({ member_id: 'both', first_name: 'Both', last_name: 'Members', phone: 'both' } as any);
                        } else {
                          const selectedMember = members.find(m => m.member_id === e.target.value);
                          setSelectedMemberForPdf(selectedMember || null);
                        }
                      }}
                      fontFamily="Montserrat, sans-serif"
                      size="sm"
                      placeholder="Choose a member"
                    >
                      {members.length > 1 && (
                        <option value="both">Both Members</option>
                      )}
                      {members.map((member) => (
                        <option key={member.member_id} value={member.member_id}>
                          {member.first_name} {member.last_name} {member.phone ? `(${member.phone})` : ''}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedMemberForPdf && (
                    <Box>
                      <Text fontSize="lg" fontWeight="bold" fontFamily="IvyJournal, sans-serif" color="#353535">
                        {selectedMemberForPdf.member_id === 'both' 
                          ? 'Both Members' 
                          : `${selectedMemberForPdf.first_name} ${selectedMemberForPdf.last_name}`
                        }
                      </Text>
                      <Text fontSize="sm" color="gray.600" fontFamily="Montserrat, sans-serif">
                        {selectedMemberForPdf.member_id === 'both' 
                          ? `Will send to ${members.filter(m => m.phone).length} member(s) with phone numbers`
                          : `Phone: ${selectedMemberForPdf.phone || 'No phone number'}`
                        }
                      </Text>
                    </Box>
                  )}
                  
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Date Range</FormLabel>
                    <Select
                      value={pdfDateRange}
                      onChange={(e) => setPdfDateRange(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="sm"
                    >
                      <option value="current_month">Current Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="last_3_months">Last 3 Months</option>
                      {showPreviousMembershipPeriod && (
                        <option value="previous_membership_period">Previous Membership Period</option>
                      )}
                      <option value="custom">Custom Range</option>
                    </Select>
                  </FormControl>

                  {pdfDateRange === 'custom' && (
                    <VStack spacing={3} w="100%">
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Start Date</FormLabel>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          fontFamily="Montserrat, sans-serif"
                          size="sm"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">End Date</FormLabel>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          fontFamily="Montserrat, sans-serif"
                          size="sm"
                        />
                      </FormControl>
                    </VStack>
                  )}

                  <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <Text fontSize="sm" color="gray.600" fontFamily="Montserrat, sans-serif">
                      The PDF will include all ledger transactions for the selected period.
                    </Text>
                  </Box>
                </VStack>
              </DrawerBody>
              <DrawerFooter borderTopWidth="1px" justifyContent="space-between" className="drawer-footer-content">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsTextPdfModalOpen(false);
                    setSelectedMemberForPdf(null);
                    setPdfDateRange('current_month');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  fontFamily="Montserrat, sans-serif"
                >
                  Cancel
                </Button>
                <Button
                  bg="#353535"
                  color="#ecede8"
                  onClick={handleTextPdf}
                  isLoading={sendingPdf}
                  loadingText="Sending..."
                  fontFamily="Montserrat, sans-serif"
                  fontWeight="semibold"
                  _hover={{ bg: '#2a2a2a' }}
                >
                  Send PDF
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Box>
        </Drawer>
      </Box>
      </div>

      {/* Mobile View - Single Column Layout */}
      <div className={styles.mobileView}>
        <div className={styles.mobileContainer}>
          {/* Mobile Header */}
          <div className={styles.mobileHeader}>
            <button 
              className={styles.mobileBackButton}
              onClick={() => router.push('/admin/members')}
            >
              ← Back
            </button>
            <button 
              className={styles.mobileAddButton}
              onClick={() => setAddMemberOpen(true)}
            >
              Add Member
            </button>
          </div>

          {loading ? (
            <div className={styles.mobileLoading}>
              Loading...
            </div>
          ) : error ? (
            <div className={styles.mobileError}>
              Error: {error}
            </div>
          ) : !members.length ? (
            <div className={styles.mobileNoMembers}>
              No members found for this account.
            </div>
          ) : (
            <div>
              {members.map(member => (
                <div key={member.member_id} className={styles.mobileMemberCard}>
                  {/* Member Header */}
                  <div className={styles.mobileMemberHeader}>
                    {member.photo ? (
                      <img 
                        src={member.photo} 
                        alt={`${member.first_name} ${member.last_name}`}
                        className={styles.mobileMemberPhoto}
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={styles.mobileMemberPhoto}>
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                    )}
                    <h2 className={styles.mobileMemberName}>
                      {member.first_name} {member.last_name}
                    </h2>
                  </div>

                  {/* Member Info */}
                  <div className={styles.mobileMemberInfo}>
                    <div className={styles.mobileInfoRow}>
                      <PhoneIcon className={styles.mobileInfoIcon} />
                      <span className={styles.mobileInfoLabel}>Phone:</span>
                      <span className={styles.mobileInfoValue}>{formatPhone(member.phone) || '—'}</span>
                    </div>
                    <div className={styles.mobileInfoRow}>
                      <EmailIcon className={styles.mobileInfoIcon} />
                      <span className={styles.mobileInfoLabel}>Email:</span>
                      <span className={styles.mobileInfoValue}>{member.email || '—'}</span>
                    </div>
                    <div className={styles.mobileInfoRow}>
                      <FaBriefcase className={styles.mobileInfoIcon} />
                      <span className={styles.mobileInfoLabel}>Company:</span>
                      <span className={styles.mobileInfoValue}>{member.company || '—'}</span>
                    </div>
                    {member.dob && (
                      <div className={styles.mobileInfoRow}>
                        <CalendarIcon className={styles.mobileInfoIcon} />
                        <span className={styles.mobileInfoLabel}>Birthdate:</span>
                        <span className={styles.mobileInfoValue}>
                          {new Date(member.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {member.join_date && (
                      <div className={styles.mobileInfoRow}>
                        <CalendarIcon className={styles.mobileInfoIcon} />
                        <span className={styles.mobileInfoLabel}>Member Since:</span>
                        <span className={styles.mobileInfoValue}>
                          {new Date(member.join_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className={styles.mobileInfoRow}>
                      <FaUser className={styles.mobileInfoIcon} />
                      <span className={styles.mobileInfoLabel}>Referred by:</span>
                      <span className={styles.mobileInfoValue}>{member.referred_by || '—'}</span>
                    </div>
                  </div>

                  {/* Attributes Section */}
                  <div className={styles.mobileAttributesSection}>
                    <div className={styles.mobileSectionHeader}>
                      Attributes
                    </div>
                    <div className={styles.mobileSectionContent}>
                      {(memberAttributes[member.member_id] || []).map(attr => (
                        <div key={attr.id} className={styles.mobileAttributeItem}>
                          <div>
                            <span className={styles.mobileAttributeKey}>{attr.key}:</span>
                            <span className={styles.mobileAttributeValue}>{attr.value}</span>
                          </div>
                          <div className={styles.mobileAttributeActions}>
                            <button className={styles.mobileEditButton}>Edit</button>
                            <button className={styles.mobileDeleteButton}>Delete</button>
                          </div>
                        </div>
                      ))}
                      <div className={styles.mobileFormRow}>
                        <input 
                          type="text" 
                          placeholder="Attribute Type" 
                          className={styles.mobileInput}
                          value={attrInputs[member.member_id]?.type || ''}
                          onChange={e => setAttrInputs(inputs => ({ ...inputs, [member.member_id]: { ...inputs[member.member_id], type: e.target.value } }))}
                        />
                        <input 
                          type="text" 
                          placeholder="Attribute Detail" 
                          className={styles.mobileInput}
                          value={attrInputs[member.member_id]?.value || ''}
                          onChange={e => setAttrInputs(inputs => ({ ...inputs, [member.member_id]: { ...inputs[member.member_id], value: e.target.value } }))}
                        />
                        <button 
                          className={styles.mobileAddButton}
                          onClick={() => handleAddAttribute(member.member_id)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className={styles.mobileNotesSection}>
                    <div className={styles.mobileSectionHeader}>
                      Notes History
                    </div>
                    <div className={styles.mobileSectionContent}>
                      {(memberNotes[member.member_id] || []).map(note => (
                        <div key={note.id} className={styles.mobileNoteItem}>
                          <div className={styles.mobileNoteText}>{note.note}</div>
                          <div className={styles.mobileNoteDate}>
                            {(() => {
                              const d = new Date(note.created_at);
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              const yy = String(d.getFullYear()).slice(-2);
                              const hh = String(d.getHours()).padStart(2, '0');
                              const min = String(d.getMinutes()).padStart(2, '0');
                              return `${mm}/${dd}/${yy} ${hh}:${min}`;
                            })()}
                          </div>
                          <div className={styles.mobileNoteActions}>
                            <button className={styles.mobileEditButton}>Edit</button>
                            <button className={styles.mobileDeleteButton}>Delete</button>
                          </div>
                        </div>
                      ))}
                      <div className={styles.mobileFormRow}>
                        <input 
                          type="text" 
                          placeholder="New note..." 
                          className={styles.mobileInput}
                          value={noteInputs[member.member_id] || ''}
                          onChange={e => setNoteInputs(inputs => ({ ...inputs, [member.member_id]: e.target.value }))}
                        />
                        <button 
                          className={styles.mobileAddButton}
                          onClick={() => handleAddNote(member.member_id)}
                        >
                          Add Note
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Ledger Section - Single for all members */}
      <div className={styles.mobileLedgerSection}>
        <div className={styles.mobileLedgerHeader}>
          <h3 className={styles.mobileLedgerTitle}>Ledger</h3>
          <button 
            className={styles.mobilePdfButton}
            onClick={() => setIsTextPdfModalOpen(true)}
          >
            📄 PDF
          </button>
        </div>
        <div className={styles.mobileSectionContent}>
          {ledgerLoading ? (
            <div className={styles.mobileLoading}>Loading ledger...</div>
          ) : (
            <div>
              {/* Mobile-optimized ledger view */}
              <div className={styles.mobileLedgerAddRow}>
                <div className={styles.mobileLedgerAddForm}>
                  <div className={styles.mobileLedgerFormRow}>
                    <input
                      type="date"
                      className={styles.mobileLedgerInput}
                      value={newTransaction.date || new Date().toISOString().split('T')[0]}
                      onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value })}
                    />
                    <select
                      className={styles.mobileLedgerSelect}
                      value={selectedTransactionMemberId}
                      onChange={e => setSelectedTransactionMemberId(e.target.value)}
                    >
                      <option value="">Select Member</option>
                      {members.map(m => (
                        <option key={m.member_id} value={m.member_id}>
                          {m.first_name} {m.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.mobileLedgerFormRow}>
                    <input
                      type="text"
                      placeholder="Note"
                      className={styles.mobileLedgerInput}
                      value={newTransaction.note || ''}
                      onChange={e => setNewTransaction({ ...newTransaction, note: e.target.value })}
                    />
                    <select
                      className={styles.mobileLedgerSelect}
                      value={newTransaction.type || ''}
                      onChange={e => setNewTransaction({ ...newTransaction, type: e.target.value })}
                    >
                      <option value="">Type</option>
                      <option value="payment">Payment</option>
                      <option value="purchase">Purchase</option>
                    </select>
                  </div>
                  <div className={styles.mobileLedgerFormRow}>
                    <input
                      type="number"
                      placeholder="Amount"
                      className={styles.mobileLedgerInput}
                      value={newTransaction.amount || ''}
                      onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    />
                    <button
                      className={styles.mobileLedgerAddButton}
                      onClick={() => handleAddTransaction(selectedTransactionMemberId, members[0].account_id)}
                      disabled={!selectedTransactionMemberId || !newTransaction.type || !newTransaction.amount || transactionStatus === 'loading'}
                    >
                      {transactionStatus === 'loading' ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Ledger transactions list */}
              <div className={styles.mobileLedgerTransactions}>
                {ledger && ledger.length > 0 ? (
                  ledger.map((tx, idx) => {
                    const txMember = members.find(m => m.member_id === tx.member_id);
                    const isEditing = editingTransaction && editingTransaction.id === tx.id;
                    
                    // Calculate running balance
                    const calculateRunningBalance = (transactions, currentIndex) => {
                      if (!transactions || currentIndex < 0) return 0;
                      return transactions.slice(0, currentIndex + 1).reduce((acc, t) => acc + Number(t.amount), 0);
                    };
                    const runningBalance = calculateRunningBalance(ledger, idx);
                    
                    return (
                      <div key={tx.id || idx} className={styles.mobileLedgerTransaction}>
                        {isEditing ? (
                          <div className={styles.mobileLedgerEditForm}>
                            <div className={styles.mobileLedgerFormRow}>
                              <input
                                type="date"
                                className={styles.mobileLedgerInput}
                                value={editTransactionForm.date || ''}
                                onChange={e => setEditTransactionForm({ ...editTransactionForm, date: e.target.value })}
                              />
                              <select
                                className={styles.mobileLedgerSelect}
                                value={editTransactionForm.member_id || ''}
                                onChange={e => setEditTransactionForm({ ...editTransactionForm, member_id: e.target.value })}
                              >
                                {members.map(m => (
                                  <option key={m.member_id} value={m.member_id}>
                                    {m.first_name} {m.last_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className={styles.mobileLedgerFormRow}>
                              <input
                                type="text"
                                placeholder="Note"
                                className={styles.mobileLedgerInput}
                                value={editTransactionForm.note || ''}
                                onChange={e => setEditTransactionForm({ ...editTransactionForm, note: e.target.value })}
                              />
                              <select
                                className={styles.mobileLedgerSelect}
                                value={editTransactionForm.type || ''}
                                onChange={e => setEditTransactionForm({ ...editTransactionForm, type: e.target.value })}
                              >
                                <option value="payment">Payment</option>
                                <option value="purchase">Purchase</option>
                              </select>
                            </div>
                            <div className={styles.mobileLedgerFormRow}>
                              <input
                                type="number"
                                placeholder="Amount"
                                className={styles.mobileLedgerInput}
                                value={editTransactionForm.amount || ''}
                                onChange={e => setEditTransactionForm({ ...editTransactionForm, amount: e.target.value })}
                              />
                              <div className={styles.mobileLedgerEditActions}>
                                <button
                                  className={styles.mobileLedgerSaveButton}
                                  onClick={() => handleUpdateTransaction(editTransactionForm)}
                                >
                                  Save
                                </button>
                                <button
                                  className={styles.mobileLedgerCancelButton}
                                  onClick={() => setEditingTransaction(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.mobileLedgerTransactionContent}>
                            <div className={styles.mobileLedgerTransactionHeader}>
                              <div className={styles.mobileLedgerTransactionDate}>
                                {new Date(tx.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </div>
                              <div className={styles.mobileLedgerTransactionAmount}>
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                }).format(tx.amount)}
                              </div>
                            </div>
                            <div className={styles.mobileLedgerTransactionDetails}>
                              <div className={styles.mobileLedgerTransactionType}>
                                {tx.type === 'payment' ? '💳 Payment' : '🛒 Purchase'}
                              </div>
                              <div className={styles.mobileLedgerTransactionMember}>
                                {txMember ? `${txMember.first_name} ${txMember.last_name}` : 'Unknown'}
                              </div>
                              {tx.note && (
                                <div className={styles.mobileLedgerTransactionNote}>
                                  {tx.note}
                                </div>
                              )}
                              {/* Running Balance Display */}
                              <div className={styles.mobileLedgerRunningBalance}>
                                Balance: {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                }).format(runningBalance)}
                              </div>
                            </div>
                            <div className={styles.mobileLedgerTransactionActions}>
                              <button
                                className={styles.mobileLedgerEditButton}
                                onClick={() => handleEditTransaction(tx)}
                              >
                                Edit
                              </button>
                              <button
                                className={styles.mobileLedgerDeleteButton}
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                Delete
                              </button>
                              <MobileAttachmentViewer
                                ledgerId={tx.id}
                                memberId={tx.member_id}
                                accountId={members[0].account_id}
                                transactionNote={tx.note || ''}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.mobileLedgerEmpty}>
                    No ledger transactions found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Message Section - Single for all members */}
      <div className={styles.mobileMessageSection}>
        <div className={styles.mobileMessageHeader}>
          Messages
        </div>
        <div className={styles.mobileMessageContent}>
          {/* Send Message Form */}
          <MobileSendMessageForm
            members={members}
            accountId={accountId as string}
            onSent={async () => {
              // Refetch messages after sending
              const res = await fetch(`/api/messages?account_id=${accountId}`);
              if (res.ok) {
                const result = await res.json();
                setMessages(result.messages || []);
              }
            }}
          />
          
          <div className={styles.mobileMessageHistory}>
            {messagesLoading ? (
              <div className={styles.mobileLoading}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <p>No messages found for this account.</p>
            ) : (
              messages.map((msg: any) => {
                const member = members.find(m => m.member_id === msg.member_id);
                const memberName = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
                
                return (
                  <div key={msg.id} className={styles.mobileMessageItem}>
                    <div className={styles.mobileMessageText}>{msg.content}</div>
                    <div className={styles.mobileMessageMeta}>
                      {new Date(msg.timestamp).toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                      })} • {memberName} • {msg.sent_by || 'System'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals - Shared between desktop and mobile */}
      <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setAddMemberOpen(false)} onSave={async (memberData: any) => {
        setAddMemberOpen(false);
      }} />
      <AddMemberModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditMember(null); }}
        onSave={handleSaveEditMember}
      />
      
      {/* Text PDF Drawer */}
      <Drawer 
        isOpen={isTextPdfModalOpen} 
        placement="right" 
        onClose={() => {
          setIsTextPdfModalOpen(false);
          setSelectedMemberForPdf(null);
          setPdfDateRange('current_month');
          setCustomStartDate('');
          setCustomEndDate('');
        }} 
        size="sm"
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" onClick={() => {
            setIsTextPdfModalOpen(false);
            setSelectedMemberForPdf(null);
            setPdfDateRange('current_month');
            setCustomStartDate('');
            setCustomEndDate('');
          }} />
                  <DrawerContent 
        border="2px solid #353535" 
        borderRadius="10px"  
        fontFamily="Montserrat, sans-serif" 
        maxW="400px" 
        w="40vw" 
        boxShadow="xl" 
        mt="80px" 
        mb="25px" 
        paddingRight="40px" 
        paddingLeft="40px" 
        backgroundColor="#ecede8"
        position="fixed"
        top="0"
        right="0"
        style={{
          transform: isTextPdfModalOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
            <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
              Send Ledger PDF via SMS
            </DrawerHeader>
            <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Select Member</FormLabel>
                  <Select
                    value={selectedMemberForPdf?.member_id || ''}
                    onChange={(e) => {
                      if (e.target.value === 'both') {
                        setSelectedMemberForPdf({ member_id: 'both', first_name: 'Both', last_name: 'Members', phone: 'both' } as any);
                      } else {
                        const selectedMember = members.find(m => m.member_id === e.target.value);
                        setSelectedMemberForPdf(selectedMember || null);
                      }
                    }}
                    fontFamily="Montserrat, sans-serif"
                    size="sm"
                    placeholder="Choose a member"
                  >
                    {members.length > 1 && (
                      <option value="both">Both Members</option>
                    )}
                    {members.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {member.first_name} {member.last_name} {member.phone ? `(${member.phone})` : ''}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                {selectedMemberForPdf && (
                  <Box>
                    <Text fontSize="lg" fontWeight="bold" fontFamily="IvyJournal, sans-serif" color="#353535">
                      {selectedMemberForPdf.member_id === 'both' 
                        ? 'Both Members' 
                        : `${selectedMemberForPdf.first_name} ${selectedMemberForPdf.last_name}`
                      }
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontFamily="Montserrat, sans-serif">
                      {selectedMemberForPdf.member_id === 'both' 
                        ? `Will send to ${members.filter(m => m.phone).length} member(s) with phone numbers`
                        : `Phone: ${selectedMemberForPdf.phone || 'No phone number'}`
                      }
                    </Text>
                  </Box>
                )}
                
                <FormControl>
                  <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Date Range</FormLabel>
                  <Select
                    value={pdfDateRange}
                    onChange={(e) => setPdfDateRange(e.target.value)}
                    fontFamily="Montserrat, sans-serif"
                    size="sm"
                  >
                    <option value="current_month">Current Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="last_3_months">Last 3 Months</option>
                    {showPreviousMembershipPeriod && (
                      <option value="previous_membership_period">Previous Membership Period</option>
                    )}
                    <option value="custom">Custom Range</option>
                  </Select>
                </FormControl>

                {pdfDateRange === 'custom' && (
                  <VStack spacing={3} w="100%">
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">Start Date</FormLabel>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        fontFamily="Montserrat, sans-serif"
                        size="sm"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1} fontFamily="Montserrat, sans-serif">End Date</FormLabel>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        fontFamily="Montserrat, sans-serif"
                        size="sm"
                      />
                    </FormControl>
                  </VStack>
                )}

                <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                  <Text fontSize="sm" color="gray.600" fontFamily="Montserrat, sans-serif">
                    The PDF will include all ledger transactions for the selected period.
                  </Text>
                </Box>
              </VStack>
            </DrawerBody>
            <DrawerFooter borderTopWidth="1px" justifyContent="space-between" className="drawer-footer-content">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsTextPdfModalOpen(false);
                  setSelectedMemberForPdf(null);
                  setPdfDateRange('current_month');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                fontFamily="Montserrat, sans-serif"
              >
                Cancel
              </Button>
              <Button
                bg="#353535"
                color="#ecede8"
                onClick={handleTextPdf}
                isLoading={sendingPdf}
                loadingText="Sending..."
                fontFamily="Montserrat, sans-serif"
                fontWeight="semibold"
                _hover={{ bg: '#2a2a2a' }}
              >
                Send PDF
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Box>
      </Drawer>
    </AdminLayout>
  );
} 