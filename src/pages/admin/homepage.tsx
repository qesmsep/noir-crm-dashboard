import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import {
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Spinner,
  Stack,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';

interface MenuFile {
  name: string;
  path: string;
  size: number;
}

export default function HomePageAdmin() {
  const [menuFiles, setMenuFiles] = useState<MenuFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchMenuFiles();
  }, []);

  const fetchMenuFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/menu-files');
      if (!response.ok) {
        throw new Error('Failed to fetch menu files');
      }
      const menuData = await response.json();
      setMenuFiles(menuData);
    } catch (error) {
      console.error('Error fetching menu files:', error);
      toast({
        title: 'Error loading menu images',
        description: 'Failed to load menu images',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('menuFiles', file);
      });

      const response = await fetch('/api/admin/upload-menu', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        title: 'Menu images uploaded',
        description: 'New images are now available on the homepage menu.',
        status: 'success',
        duration: 3000,
      });
      fetchMenuFiles();
    } catch (error) {
      console.error('Error uploading menu images:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload menu images',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMenuFile = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      const response = await fetch('/api/admin/delete-menu-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast({
        title: 'Image deleted',
        status: 'success',
        duration: 3000,
      });
      fetchMenuFiles();
    } catch (error) {
      console.error('Error deleting menu file:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete menu image',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <AdminLayout>
      <Box bg="#F6F5F2" minH="100vh" py={{ base: 6, md: 10 }}>
        <Box maxW="1100px" mx="auto" px={{ base: 4, md: 8 }}>
          <VStack align="stretch" spacing={{ base: 6, md: 8 }}>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              spacing={{ base: 3, md: 6 }}
            >
              <Box>
                <Heading size="lg" fontWeight={700} color="#1F1F1F">HomePage</Heading>
                <Text mt={2} color="gray.600" fontSize="sm">
                  Manage the menu images shown on the homepage carousel.
                </Text>
              </Box>
              <HStack spacing={3}>
                <Button
                  variant="outline"
                  color="#2C2C2C"
                  borderColor="#DAD7D0"
                  _hover={{ bg: 'white' }}
                  onClick={fetchMenuFiles}
                  isLoading={loading}
                >
                  Refresh
                </Button>
                <Button
                  as="label"
                  htmlFor="menu-upload"
                  bg="#1F1F1F"
                  color="white"
                  _hover={{ bg: '#2A2A2A' }}
                  isLoading={uploading}
                >
                  Upload Images
                  <input
                    id="menu-upload"
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    hidden
                    onChange={handleMenuUpload}
                  />
                </Button>
              </HStack>
            </Stack>

            <Box bg="white" borderRadius="xl" border="1px solid #ECEAE5" boxShadow="sm">
              <Box px={{ base: 4, md: 6 }} pt={{ base: 4, md: 6 }} pb={4}>
                <HStack justify="space-between" align="center">
                  <Heading size="md" color="#1F1F1F">Homepage Menu Images</Heading>
                  <Badge
                    color="#8C7C6D"
                    bg="#F3F1EC"
                    border="1px solid #E6E0D8"
                    px={2}
                    py={1}
                    borderRadius="full"
                    fontWeight={600}
                  >
                    {menuFiles.length} images
                  </Badge>
                </HStack>
              </Box>
              <Divider borderColor="#ECEAE5" />
              <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }}>
                {loading ? (
                  <HStack spacing={3} color="gray.600">
                    <Spinner size="sm" />
                    <Text>Loading images...</Text>
                  </HStack>
                ) : (
                  <Grid
                    templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }}
                    gap={{ base: 4, md: 6 }}
                  >
                    {menuFiles.length === 0 && (
                      <GridItem>
                        <Text color="gray.600">No menu images uploaded yet.</Text>
                      </GridItem>
                    )}
                    {menuFiles.map((file) => (
                      <GridItem
                        key={file.name}
                        border="1px solid #EFEDE8"
                        borderRadius="lg"
                        overflow="hidden"
                        bg="#FBFBFA"
                      >
                        <Box bg="white" borderBottom="1px solid #EFEDE8" px={4} py={3}>
                          <Text fontWeight={600} color="#1F1F1F" noOfLines={1}>
                            {file.name}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {(file.size / 1024).toFixed(1)} KB
                          </Text>
                        </Box>
                        <Box bg="#F7F6F3" px={4} py={3} display="flex" justifyContent="center">
                          <Image
                            src={file.path}
                            alt={file.name}
                            width="100%"
                            maxH={{ base: '120px', md: '140px' }}
                            objectFit="contain"
                          />
                        </Box>
                        <HStack px={4} py={3} spacing={2} justify="space-between">
                          <Button
                            as="a"
                            href={file.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="sm"
                            variant="ghost"
                            color="#5A5A5A"
                            _hover={{ bg: '#F0EEE9' }}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            color="#8B4A4A"
                            leftIcon={<DeleteIcon />}
                            _hover={{ bg: '#F3E7E7' }}
                            onClick={() => handleDeleteMenuFile(file.name)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </GridItem>
                    ))}
                  </Grid>
                )}
              </Box>
            </Box>
          </VStack>
        </Box>
      </Box>
    </AdminLayout>
  );
}
