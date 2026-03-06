import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@/hooks/useToast';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import Image from 'next/image';
import styles from '../styles/ArchivedMembersModal.module.css';

interface PendingMember {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  member_type?: string;
  join_date?: string;
  status?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStatusChangeSuccess?: () => void;
}

export default function PendingMembersModal({ isOpen, onClose, onStatusChangeSuccess }: Props) {
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchPendingMembers();
    }
  }, [isOpen]);

  const fetchPendingMembers = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('status', 'pending')
        .eq('deactivated', false)
        .order('join_date', { ascending: false });

      if (error) throw error;
      setPendingMembers(data || []);
    } catch (err: any) {
      console.error('Error fetching pending members:', err);
      toast({
        title: 'Error',
        description: 'Failed to load pending members',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkIncomplete = async (memberId: string, memberName: string) => {
    if (!confirm(`Mark ${memberName} as incomplete? This will remove them from pending status.`)) {
      return;
    }

    setProcessing(memberId);
    try {
      const response = await fetch(`/api/members/${memberId}/mark-incomplete`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark member as incomplete');
      }

      toast({
        title: 'Status Updated',
        description: `${memberName} has been marked as incomplete`,
        variant: 'success',
      });

      // Refresh the list
      await fetchPendingMembers();

      // Notify parent component
      if (onStatusChangeSuccess) {
        onStatusChangeSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update member status',
        variant: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleViewMember = (accountId: string) => {
    router.push(`/admin/members/${accountId}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Pending Members</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : pendingMembers.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No pending members</p>
            </div>
          ) : (
            <div className={styles.membersList}>
              {pendingMembers.map((member) => (
                <div key={member.member_id} className={styles.memberCard}>
                  <div className={styles.memberInfo} onClick={() => handleViewMember(member.account_id)}>
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt={`${member.first_name} ${member.last_name}`}
                        width={48}
                        height={48}
                        className={styles.memberPhoto}
                      />
                    ) : (
                      <div className={styles.memberPhotoPlaceholder}>
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                    )}
                    <div className={styles.memberDetails}>
                      <div className={styles.memberName}>
                        {member.first_name} {member.last_name}
                        {member.member_type === 'primary' && (
                          <span className={styles.primaryBadge}>Primary</span>
                        )}
                      </div>
                      {member.email && <div className={styles.memberContact}>{member.email}</div>}
                      {member.phone && <div className={styles.memberContact}>{member.phone}</div>}
                      {member.join_date && (
                        <div className={styles.memberJoinDate}>
                          Joined: {new Date(member.join_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className={styles.actionButton}
                    onClick={() => handleMarkIncomplete(member.member_id, `${member.first_name} ${member.last_name}`)}
                    disabled={processing === member.member_id}
                  >
                    {processing === member.member_id ? 'Processing...' : 'Mark Incomplete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
