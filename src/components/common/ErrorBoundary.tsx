'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Heading, Text, Button, VStack, Container } from '@chakra-ui/react';
import { Logger } from '../../lib/logger-client';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 * Prevents the entire app from crashing when a component fails
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    Logger.error('React Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Container maxW="container.md" py={20}>
          <VStack spacing={6} align="center" textAlign="center">
            <Box
              fontSize="6xl"
              fontWeight="bold"
              bgGradient="linear(to-r, red.400, red.600)"
              bgClip="text"
            >
              Oops!
            </Box>
            <Heading size="lg" color="gray.700">
              Something went wrong
            </Heading>
            <Text color="gray.600" fontSize="lg">
              We're sorry for the inconvenience. An unexpected error occurred.
            </Text>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                mt={6}
                p={4}
                bg="red.50"
                borderRadius="md"
                border="1px"
                borderColor="red.200"
                width="100%"
                textAlign="left"
              >
                <Text fontWeight="bold" color="red.600" mb={2}>
                  Error Details (Development Only):
                </Text>
                <Text fontSize="sm" fontFamily="mono" color="red.600" whiteSpace="pre-wrap">
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    color="gray.600"
                    mt={2}
                    maxH="200px"
                    overflowY="auto"
                  >
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </Box>
            )}

            <VStack spacing={3} pt={4}>
              <Button colorScheme="blue" size="lg" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => (window.location.href = '/')}
              >
                Go to Home
              </Button>
            </VStack>
          </VStack>
        </Container>
      );
    }

    return this.props.children;
  }
}

/**
 * Minimal error boundary for specific components
 * Shows inline error message instead of full page
 */
export class InlineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Logger.error('Inline Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          p={4}
          bg="red.50"
          borderRadius="md"
          border="1px"
          borderColor="red.200"
        >
          <Text fontWeight="bold" color="red.600" mb={2}>
            Component Error
          </Text>
          <Text fontSize="sm" color="red.600" mb={3}>
            This component failed to load. Please try again.
          </Text>
          <Button size="sm" colorScheme="red" variant="outline" onClick={this.handleReset}>
            Retry
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
