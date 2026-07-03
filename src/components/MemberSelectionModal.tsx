import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, User, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '../lib/supabase';
import debounce from 'lodash.debounce';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

interface MemberSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: Member | null) => void;
}

export default function MemberSelectionModal({
  isOpen,
  onClose,
  onSelectMember,
}: MemberSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [mounted, setMounted] = useState(false);

  // Format phone number to (xxx)xxx-xxxx
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Format as (xxx)xxx-xxxx
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      // Handle +1 prefix
      return `(${digits.slice(1, 4)})${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone; // Return original if not 10 or 11 digits
  };

  // Debounced search query update
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300),
    []
  );

  // Update search query and trigger debounced update
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    debouncedSetSearch(value);
  }, [debouncedSetSearch]);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      debouncedSetSearch.cancel(); // Cancel any pending debounced calls
    };
  }, [debouncedSetSearch]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch members on mount
  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen]);

  // Filter members based on debounced search
  useEffect(() => {
    if (debouncedSearchQuery.trim() === '') {
      setFilteredMembers([]);  // Don't show any members initially
    } else {
      const query = debouncedSearchQuery.toLowerCase();
      const filtered = members.filter((member) => {
        const firstName = (member.first_name || '').toLowerCase();
        const lastName = (member.last_name || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const phone = (member.phone || '').toLowerCase();
        const email = (member.email || '').toLowerCase();

        // Check if any field starts with or contains the query
        return firstName.startsWith(query) ||
               lastName.startsWith(query) ||
               fullName.includes(query) ||
               phone.includes(query) ||
               email.includes(query);
      });
      // Sort by relevance (names starting with query first)
      filtered.sort((a, b) => {
        const aStarts = (a.first_name || '').toLowerCase().startsWith(query) || (a.last_name || '').toLowerCase().startsWith(query);
        const bStarts = (b.first_name || '').toLowerCase().startsWith(query) || (b.last_name || '').toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
      setFilteredMembers(filtered.slice(0, 10));  // Show top 10 matches
    }
  }, [debouncedSearchQuery, members]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('member_id, first_name, last_name, phone, email')
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;

      // Map member_id to id for consistency
      const mappedData = (data || []).map(member => ({
        ...member,
        id: member.member_id
      }));

      setMembers(mappedData);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError('Unable to load members. Please try again.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
  };

  const handleConfirmSelection = () => {
    onSelectMember(selectedMember);
    handleClose();
  };

  const handleNonMember = () => {
    onSelectMember(null);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    // Reset state
    setSearchQuery('');
    setSelectedMember(null);
    // Body scroll is handled by useEffect cleanup
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999999,
        padding: '20px',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '90%',
          maxWidth: '500px',
          maxHeight: 'calc(100vh - 40px)',
          backgroundColor: '#ecede8',
          borderRadius: '10px',
          border: '2px solid #353535',
          fontFamily: 'Montserrat, sans-serif',
        }}
      >
        {/* Header */}
        <div className="border-b p-4 pb-2 pt-3 flex-shrink-0" style={{ fontFamily: 'IvyJournal, sans-serif' }}>
          <h2 className="text-xl font-bold" style={{ color: '#353535' }}>
            Select Guest
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close"
            className="absolute top-2 right-2 text-2xl"
            style={{ color: '#353535' }}
          >
            ×
          </Button>
        </div>

        {/* Body */}
        <div className="p-3 overflow-y-auto flex-1">
          {/* Search Input */}
          <div className="mb-3 relative">
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#666'
              }}
            />
            <Input
              className="h-10 pl-10"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                backgroundColor: '#ffffff',
                border: '1px solid #353535'
              }}
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          {/* Non-member Option */}
          <button
            onClick={handleNonMember}
            className="w-full mb-3 p-3 flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #353535',
              borderRadius: '6px',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              color: '#353535',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <User size={18} />
            Non-Member / Walk-in Guest
          </button>

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: '#fee',
              border: '1px solid #f00',
              borderRadius: '4px',
              fontSize: '13px',
              color: '#d00',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Members List - Shows when typing */}
          {searchQuery.trim() && (
            <div className="mb-2">
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                {filteredMembers.length > 0 ? 'Select a member:' : 'No members found'}
              </p>

              {loading ? (
                <div className="text-center py-4">
                  <span style={{ color: '#666' }}>Searching...</span>
                </div>
              ) : (
                filteredMembers.length > 0 && (
                  <div
                    style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid #353535',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => handleSelectMember(member)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e5e5',
                        backgroundColor: selectedMember?.id === member.id ? '#f5f5f5' : '#ffffff',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedMember?.id !== member.id) {
                          e.currentTarget.style.backgroundColor = '#fafafa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedMember?.id !== member.id) {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Users size={16} style={{ marginRight: '8px', color: '#666' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#353535' }}>
                            {member.first_name} {member.last_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {member.phone && `${formatPhoneNumber(member.phone)}`}
                            {member.phone && member.email && ' • '}
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3 flex-shrink-0" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #353535',
              color: '#353535',
              padding: '8px 16px',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={!selectedMember}
            style={{
              backgroundColor: selectedMember ? '#353535' : '#999',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              fontFamily: 'Montserrat, sans-serif',
              fontSize: '14px',
              fontWeight: '600',
              cursor: selectedMember ? 'pointer' : 'not-allowed',
            }}
          >
            Continue with Selected Member
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}