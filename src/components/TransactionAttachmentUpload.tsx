import React, { useState, useEffect, useRef } from 'react';
import {
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Divider,
  useToast,
  Spinner,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerFooter,
  Input,
  FormControl,
  FormLabel,
  Badge,
  Flex,
  useDisclosure,
} from '@chakra-ui/react';
import { AttachmentIcon, DownloadIcon, DeleteIcon, CloseIcon } from '@chakra-ui/icons';

interface TransactionAttachmentUploadProps {
  ledgerId: string;
  memberId: string;
  accountId: string;
  transactionNote: string;
  onUploadSuccess?: () => void;
}

const TransactionAttachmentUpload: React.FC<TransactionAttachmentUploadProps> = ({
  ledgerId,
  memberId,
  accountId,
  transactionNote,
  onUploadSuccess,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchAttachments();
    }
  }, [isOpen, ledgerId]);

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
      toast({
        title: 'Error',
        description: 'Failed to load attachments',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Define allowed file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/rtf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/zip',
      'application/x-rar-compressed'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF, Word, Excel, PowerPoint, text, image, or archive files.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 10MB',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('ledgerId', ledgerId);
    formData.append('memberId', memberId);
    formData.append('accountId', accountId);

    console.log('Uploading with data:', {
      ledgerId,
      memberId,
      accountId,
      fileName: selectedFile.name
    });

    try {
      console.log('Sending upload request...');
      const response = await fetch('/api/transaction-attachments/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        toast({
          title: 'Success',
          description: 'File uploaded successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchAttachments();
        onUploadSuccess?.();
      } else {
        const error = await response.json();
        console.error('Upload failed:', error);
        toast({
          title: 'Upload failed',
          description: error.error || 'Failed to upload file',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'An error occurred while uploading the file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/transaction-attachments/${ledgerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attachmentId }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Attachment deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        fetchAttachments();
      } else {
        toast({
          title: 'Delete failed',
          description: 'Failed to delete attachment',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: 'An error occurred while deleting the attachment',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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

  return (
    <>
      <Button
        size="sm"
        leftIcon={<AttachmentIcon />}
        onClick={onOpen}
        bg="#353535"
        color="#ecede8"
        _hover={{ bg: '#2a2a2a' }}
        borderRadius="lg"
        px={3}
        py={1}
      >
        Attachments ({attachmentCount})
      </Button>

      <Drawer 
        isOpen={isOpen} 
        placement="right" 
        onClose={onClose} 
        size="sm"
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
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
              transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'transform',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden'
            }}
          >
            <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
              <HStack justify="space-between" align="center">
                <Text>Transaction Attachments</Text>
                <IconButton
                  aria-label="Close drawer"
                  icon={<CloseIcon />}
                  size="sm"
                  variant="ghost"
                  bg="#353535"
                  onClick={onClose}
                  color="#ECEDE8"
                  _hover={{ bg: '#2a2a2a' }}
                />
              </HStack>
            </DrawerHeader>

            <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
              {isLoading ? (
                <VStack justify="center" align="center" h="100%">
                  <Spinner size="xl" />
                </VStack>
              ) : (
                <VStack spacing={4} align="stretch">
                  {/* Upload Section */}
                  <Box>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={2} fontFamily="Montserrat, sans-serif">
                        Upload File Attachment
                      </FormLabel>
                      <VStack spacing={3} align="stretch">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar"
                          onChange={handleFileSelect}
                          disabled={isUploading}
                          fontFamily="Montserrat, sans-serif"
                          size="sm"
                        />
                        
                        {selectedFile && (
                          <Box p={3} border="1px solid" borderColor="green.200" borderRadius="md" bg="green.50">
                            <VStack align="start" spacing={1}>
                              <Text fontSize="sm" fontWeight="semibold" color="green.700" fontFamily="Montserrat, sans-serif">
                                Selected File: {selectedFile.name}
                              </Text>
                              <Text fontSize="xs" color="green.600" fontFamily="Montserrat, sans-serif">
                                Size: {formatFileSize(selectedFile.size)}
                              </Text>
                              <Button
                                size="sm"
                                colorScheme="green"
                                onClick={handleFileUpload}
                                disabled={isUploading}
                                fontFamily="Montserrat, sans-serif"
                                mt={2}
                              >
                                {isUploading ? 'Uploading...' : 'Upload File'}
                              </Button>
                            </VStack>
                          </Box>
                        )}
                        
                        {isUploading && (
                          <HStack mt={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm" color="gray.600">Uploading...</Text>
                          </HStack>
                        )}
                      </VStack>
                    </FormControl>
                  </Box>

                  <Divider />

                  {/* Attachments List */}
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={3} fontFamily="Montserrat, sans-serif">
                      Attached Files ({attachments.length})
                    </Text>
                    
                    {attachments.length === 0 ? (
                      <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                        No attachments uploaded yet
                      </Text>
                    ) : (
                      <VStack spacing={3} align="stretch">
                        {attachments.map((attachment) => (
                          <Box
                            key={attachment.id}
                            p={3}
                            border="1px solid"
                            borderColor="gray.200"
                            borderRadius="md"
                            bg="white"
                          >
                            <VStack align="stretch" spacing={2}>
                              <HStack justify="space-between" align="start">
                                <VStack align="start" spacing={1} flex={1}>
                                  <Text fontSize="sm" fontWeight="semibold" fontFamily="Montserrat, sans-serif">
                                    {attachment.file_name}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500" fontFamily="Montserrat, sans-serif">
                                    {formatFileSize(attachment.file_size)} • {formatDate(attachment.uploaded_at)}
                                  </Text>
                                </VStack>
                                
                                <HStack spacing={1}>
                                  <IconButton
                                    aria-label="Download file"
                                    icon={<DownloadIcon />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(attachment.file_url, '_blank')}
                                    color="blue.500"
                                    _hover={{ bg: 'blue.50' }}
                                  />
                                  <IconButton
                                    aria-label="Delete file"
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(attachment.id)}
                                    color="red.500"
                                    _hover={{ bg: 'red.50' }}
                                  />
                                </HStack>
                              </HStack>
                            </VStack>
                          </Box>
                        ))}
                      </VStack>
                    )}
                  </Box>
                </VStack>
              )}
            </DrawerBody>

            <DrawerFooter className="drawer-footer-content">
              <Button
                onClick={onClose}
                bg="#353535"
                color="#ecede8"
                _hover={{ bg: '#2a2a2a' }}
                fontFamily="Montserrat, sans-serif"
                borderRadius="lg"
              >
                Close
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Box>
      </Drawer>
    </>
  );
};

export default TransactionAttachmentUpload; 