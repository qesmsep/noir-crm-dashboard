import React, { useState, useEffect } from 'react';
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
  useDisclosure,
} from '@chakra-ui/react';
import { AttachmentIcon, DownloadIcon, CloseIcon } from '@chakra-ui/icons';

interface TransactionAttachmentViewerProps {
  ledgerId: string;
  memberId: string;
  accountId: string;
  transactionNote: string;
}

const TransactionAttachmentViewer: React.FC<TransactionAttachmentViewerProps> = ({
  ledgerId,
  memberId,
  accountId,
  transactionNote,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachmentCount, setAttachmentCount] = useState(0);
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
        setAttachments(data.attachments || []);
        setAttachmentCount(data.attachments?.length || 0);
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
        View Files ({attachmentCount})
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
                <Text>Transaction Files</Text>
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
                  {/* Attachments List */}
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={3} fontFamily="Montserrat, sans-serif">
                      Attached Files ({attachments.length})
                    </Text>
                    
                    {attachments.length === 0 ? (
                      <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                        No files attached to this transaction
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
                                
                                <IconButton
                                  aria-label="Download file"
                                  icon={<DownloadIcon />}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(attachment.file_url, '_blank')}
                                  color="blue.500"
                                  _hover={{ bg: 'blue.50' }}
                                />
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

export default TransactionAttachmentViewer; 