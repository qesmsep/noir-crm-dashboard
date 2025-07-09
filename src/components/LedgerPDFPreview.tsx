import React, { useState } from 'react';
import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Spinner,
  Text,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Badge,
  Divider
} from '@chakra-ui/react';

interface LedgerPDFPreviewProps {
  memberId: string;
  memberName: string;
  accountId: string;
}

export default function LedgerPDFPreview({ memberId, memberName, accountId }: LedgerPDFPreviewProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set default date range (last 30 days)
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  const generatePreview = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/generate-ledger-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      // Create blob URL for the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <>
      <Button
        colorScheme="blue"
        variant="outline"
        size="sm"
        onClick={onOpen}
      >
        Preview PDF
      </Button>

      <Modal isOpen={isOpen} onClose={handleClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Ledger PDF Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              {/* Member Info Card */}
              <Card>
                <CardHeader>
                  <Heading size="md">Member Information</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Name:</Text>
                      <Text>{memberName}</Text>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontWeight="bold">Account ID:</Text>
                      <Text fontFamily="mono">{accountId}</Text>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>

              {/* Date Range Selection */}
              <Card>
                <CardHeader>
                  <Heading size="md">Select Date Range</Heading>
                </CardHeader>
                <CardBody>
                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel>Start Date</FormLabel>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>End Date</FormLabel>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </FormControl>
                    <Button
                      colorScheme="blue"
                      onClick={generatePreview}
                      isLoading={loading}
                      loadingText="Generating..."
                      alignSelf="end"
                    >
                      Generate Preview
                    </Button>
                  </HStack>
                </CardBody>
              </Card>

              {/* Error Display */}
              {error && (
                <Alert status="error">
                  <AlertIcon />
                  <AlertTitle>Error!</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* PDF Preview */}
              {previewUrl && (
                <Card>
                  <CardHeader>
                    <Heading size="md">PDF Preview</Heading>
                  </CardHeader>
                  <CardBody>
                    <Box
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      overflow="hidden"
                      height="600px"
                    >
                      <iframe
                        src={previewUrl}
                        width="100%"
                        height="100%"
                        style={{ border: 'none' }}
                        title="Ledger PDF Preview"
                      />
                    </Box>
                  </CardBody>
                </Card>
              )}

              {/* Loading State */}
              {loading && (
                <Card>
                  <CardBody>
                    <VStack spacing={4}>
                      <Spinner size="xl" />
                      <Text>Generating PDF preview...</Text>
                    </VStack>
                  </CardBody>
                </Card>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
} 