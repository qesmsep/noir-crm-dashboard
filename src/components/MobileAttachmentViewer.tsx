import React, { useState, useEffect } from 'react';
import { useDisclosure } from '@chakra-ui/react';
import { AttachmentIcon } from '@chakra-ui/icons';

interface MobileAttachmentViewerProps {
  ledgerId: string;
  memberId: string;
  accountId: string;
  transactionNote: string;
}

const MobileAttachmentViewer: React.FC<MobileAttachmentViewerProps> = ({
  ledgerId,
  memberId,
  accountId,
  transactionNote,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);

  useEffect(() => {
    fetchAttachments();
  }, [ledgerId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/transaction-attachments/${ledgerId}`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data.data || []);
        setAttachmentCount(data.data?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (attachmentCount === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={onOpen}
        className="mobileAttachmentButton"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          color: '#A59480',
          padding: '4px 8px',
          borderRadius: '4px',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <AttachmentIcon boxSize={3} />
        <span>{attachmentCount}</span>
      </button>

      {/* Mobile Attachment Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={onClose}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#353535' }}>
                Attachments ({attachmentCount})
              </h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading attachments...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {attachments.map((attachment, index) => (
                  <div
                    key={attachment.id || index}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      backgroundColor: '#f7fafc'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#353535' }}>
                        {attachment.file_name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {formatFileSize(attachment.file_size)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      {formatDate(attachment.created_at)}
                    </div>
                    <a
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#A59480',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      View File
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileAttachmentViewer; 