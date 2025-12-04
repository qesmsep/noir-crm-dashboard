'use client';

import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Divider,
  Alert,
  AlertIcon,
  useToast,
  Spinner,
  Image,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';

interface MenuFile {
  name: string;
  path: string;
  size: number;
}

interface HomePageImage {
  name: string;
  path: string;
  current: boolean;
}

export default function WebsiteAdmin() {
  const [menuFiles, setMenuFiles] = useState<MenuFile[]>([]);
  const [homePageImages, setHomePageImages] = useState<HomePageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [menuResponse, imagesResponse] = await Promise.all([
        fetch('/api/admin/menu-files'),
        fetch('/api/admin/homepage-images'),
      ]);

      if (menuResponse.ok) {
        const menuData = await menuResponse.json();
        setMenuFiles(menuData);
      }

      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        setHomePageImages(imagesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load website data',
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

      if (response.ok) {
        toast({
          title: 'Menu files uploaded successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload menu files',
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

      if (response.ok) {
        toast({
          title: 'File deleted successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete menu file',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleHomePageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/admin/upload-homepage-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        toast({
          title: 'Homepage images uploaded successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload homepage images',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageName: string) => {
    if (!confirm(`Are you sure you want to delete ${imageName}?`)) return;

    try {
      const response = await fetch('/api/admin/delete-homepage-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageName }),
      });

      if (response.ok) {
        toast({
          title: 'Image deleted successfully',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete homepage image',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSetHomePageImage = async (imageName: string) => {
    try {
      const response = await fetch('/api/admin/set-homepage-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageName }),
      });

      if (response.ok) {
        toast({
          title: 'Homepage image updated',
          status: 'success',
          duration: 3000,
        });
        fetchData();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to set homepage image',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <AdminLayout>
      <Box maxW="1200px" mx="auto" py={10} px={6}>
        <VStack align="stretch" spacing={8}>
          <HStack justify="space-between" align="center">
            <Heading size="lg" fontWeight={700}>Website Admin</Heading>
            <Button colorScheme="blue" variant="outline" onClick={fetchData} isLoading={loading}>
              Refresh
            </Button>
          </HStack>

          <Alert status="info" borderRadius="md">
            <AlertIcon />
            Manage menu files and homepage hero images.
          </Alert>

          <VStack align="stretch" spacing={6}>
            <Box p={6} borderRadius="lg" boxShadow="sm" bg="white">
              <HStack justify="space-between" mb={4}>
                <Heading size="md">Menu Files</Heading>
                <Button
                  as="label"
                  htmlFor="menu-upload"
                  colorScheme="teal"
                  isLoading={uploading}
                >
                  Upload Menus
                  <input
                    id="menu-upload"
                    type="file"
                    accept=".pdf,.jpg,.png"
                    multiple
                    hidden
                    onChange={handleMenuUpload}
                  />
                </Button>
              </HStack>
              <Divider mb={4} />
              {loading ? (
                <Spinner />
              ) : (
                <VStack align="stretch" spacing={3}>
                  {menuFiles.length === 0 && <Text>No menu files uploaded.</Text>}
                  {menuFiles.map((file) => (
                    <HStack key={file.name} justify="space-between" p={3} borderWidth={1} borderRadius="md">
                      <VStack align="start" spacing={0}>
                        <Text fontWeight={600}>{file.name}</Text>
                        <Text fontSize="sm" color="gray.600">{(file.size / 1024).toFixed(1)} KB</Text>
                      </VStack>
                      <HStack>
                        <Button as="a" href={file.path} target="_blank" rel="noopener noreferrer" size="sm">
                          View
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="red"
                          leftIcon={<DeleteIcon />}
                          onClick={() => handleDeleteMenuFile(file.name)}
                        >
                          Delete
                        </Button>
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              )}
            </Box>

            <Box p={6} borderRadius="lg" boxShadow="sm" bg="white">
              <HStack justify="space-between" mb={4}>
                <Heading size="md">Homepage Images</Heading>
                <Button
                  as="label"
                  htmlFor="homepage-upload"
                  colorScheme="teal"
                  isLoading={uploading}
                >
                  Upload Images
                  <input
                    id="homepage-upload"
                    type="file"
                    accept=".jpg,.png,.webp"
                    multiple
                    hidden
                    onChange={handleHomePageUpload}
                  />
                </Button>
              </HStack>
              <Divider mb={4} />
              {loading ? (
                <Spinner />
              ) : (
                <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
                  {homePageImages.map((image) => (
                    <GridItem key={image.name} borderWidth={1} borderRadius="md" overflow="hidden">
                      <Image src={image.path} alt={image.name} width="100%" height="200px" objectFit="cover" />
                      <Box p={3}>
                        <Text fontWeight={600}>{image.name}</Text>
                        <HStack mt={2} spacing={2}>
                          <Button size="sm" onClick={() => handleSetHomePageImage(image.name)} isDisabled={image.current}>
                            {image.current ? 'Current' : 'Set as Hero'}
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="red"
                            leftIcon={<DeleteIcon />}
                            onClick={() => handleDeleteImage(image.name)}
                          >
                            Delete
                          </Button>
                        </HStack>
                      </Box>
                    </GridItem>
                  ))}
                </Grid>
              )}
            </Box>
          </VStack>
        </VStack>
      </Box>
    </AdminLayout>
  );
}

