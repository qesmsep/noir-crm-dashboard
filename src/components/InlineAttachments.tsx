import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@chakra-ui/react';
import styles from '../styles/InlineAttachments.module.css';

interface InlineAttachmentsProps {
  ledgerId: string;
  memberId?: string;
  accountId?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
}

const InlineAttachments: React.FC<InlineAttachmentsProps> = ({ ledgerId, memberId, accountId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAttachments, setShowAttachments] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [ledgerId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/transaction-attachments/${ledgerId}`);
      if (response.ok) {
        const result = await response.json();
        // API returns { data: [...] }
        setAttachments(result.data || result.attachments || []);
      } else {
        console.error('Failed to fetch attachments:', response.status);
        setAttachments([]);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setAttachments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!memberId || !accountId) {
      toast({
        title: 'Missing information',
        description: 'Unable to upload attachment. Member or account ID is missing.',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('ledgerId', ledgerId);
    formData.append('memberId', memberId);
    formData.append('accountId', accountId);

    try {
      const response = await fetch('/api/transaction-attachments/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: 'File uploaded successfully',
          status: 'success',
          duration: 3000,
        });
        fetchAttachments();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload file',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleViewAttachment = (attachment: Attachment) => {
    setViewingAttachment(attachment);
  };

  const handleCloseViewer = () => {
    setViewingAttachment(null);
  };

  const handleDownload = () => {
    if (!viewingAttachment) return;

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = viewingAttachment.file_url;
    link.download = viewingAttachment.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Download started',
      status: 'info',
      duration: 2000,
    });
  };

  const handleShare = async () => {
    if (!viewingAttachment) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: viewingAttachment.file_name,
          url: viewingAttachment.file_url,
        });
        toast({
          title: 'Shared successfully',
          status: 'success',
          duration: 2000,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(viewingAttachment.file_url);
        toast({
          title: 'Link copied to clipboard',
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        toast({
          title: 'Could not copy link',
          status: 'error',
          duration: 3000,
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!viewingAttachment) return;

    if (!confirm(`Delete ${viewingAttachment.file_name}? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/transaction-attachments/${viewingAttachment.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Attachment deleted',
          status: 'success',
          duration: 3000,
        });
        handleCloseViewer();
        fetchAttachments();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({
        title: 'Delete failed',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      default:
        return '📎';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.attachmentsWrapper}>
        <div className={styles.loadingIndicator}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.attachmentsWrapper}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
      />

      <div className={styles.attachmentControls}>
        <button
          onClick={() => {
            if (attachments.length === 1) {
              handleViewAttachment(attachments[0]);
            } else {
              setShowAttachments(!showAttachments);
            }
          }}
          className={styles.toggleButton}
          title={`${attachments.length} ${attachments.length === 1 ? 'attachment' : 'attachments'}`}
        >
          📎 {attachments.length}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={styles.uploadButton}
          title="Upload attachment"
        >
          {uploading ? '⏳' : '➕'}
        </button>
      </div>

      {showAttachments && attachments.length > 1 && (
        <div className={styles.attachmentsList}>
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              onClick={() => handleViewAttachment(attachment)}
              className={styles.attachmentItem}
              title={`View ${attachment.file_name}`}
            >
              <span className={styles.fileIcon}>{getFileIcon(attachment.file_name)}</span>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{attachment.file_name}</div>
                <div className={styles.fileSize}>{formatFileSize(attachment.file_size)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewingAttachment && (
        <div className={styles.viewerOverlay} onClick={handleCloseViewer}>
          <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseViewer}
              className={styles.closeButton}
              title="Close"
            >
              ✕
            </button>
            <div className={styles.viewerHeader}>
              <h3 className={styles.viewerTitle}>{viewingAttachment.file_name}</h3>
              <div className={styles.viewerActions}>
                <button
                  onClick={handleDownload}
                  className={`${styles.actionButton} ${styles.download}`}
                  title="Download"
                >
                  ↓
                </button>
                <button
                  onClick={handleShare}
                  className={`${styles.actionButton} ${styles.share}`}
                  title="Share"
                >
                  ↗
                </button>
                <button
                  onClick={handleDelete}
                  className={`${styles.actionButton} ${styles.delete}`}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
            <div className={styles.viewerBody}>
              <iframe
                src={viewingAttachment.file_url}
                className={styles.viewerFrame}
                title={viewingAttachment.file_name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlineAttachments;
