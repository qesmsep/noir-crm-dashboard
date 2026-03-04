'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorLogger, logComponentError } from '@/lib/errorLogger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary that SHOWS errors instead of hiding them
 *
 * This ensures bugs get fixed rather than silently failing
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    logComponentError(this.constructor.name, error, { componentStack: errorInfo.componentStack || '' });

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/member/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, show detailed error (no hiding!)
      return (
        <div className="min-h-screen bg-[#ECEDE8] flex items-center justify-center p-4">
          <Card className="bg-white rounded-2xl border-2 border-red-200 shadow-lg max-w-2xl w-full">
            <CardHeader className="border-b border-[#ECEAE5]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-[#1F1F1F]">
                  Something Went Wrong
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-[#5A5A5A]">
                  An error occurred while loading this page. We've logged the issue and will investigate.
                </p>

                {/* Show error details in development */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-2">
                      Error Details (Development Only):
                    </p>
                    <pre className="text-xs text-red-700 overflow-x-auto whitespace-pre-wrap break-words">
                      {this.state.error.toString()}
                    </pre>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-red-800 cursor-pointer">
                          Component Stack
                        </summary>
                        <pre className="text-xs text-red-700 mt-2 overflow-x-auto whitespace-pre-wrap break-words">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Show production-friendly message */}
                {process.env.NODE_ENV === 'production' && this.state.error && (
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Error:</strong> {this.state.error.message}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      This error has been logged and our team will review it.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button
                    className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D] flex items-center justify-center gap-2"
                    onClick={this.handleReload}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] flex items-center justify-center gap-2"
                    onClick={this.handleGoHome}
                  >
                    <Home className="w-4 h-4" />
                    Go Home
                  </Button>
                </div>

                <p className="text-xs text-[#8C7C6D] text-center mt-4">
                  If this problem persists, please contact support at{' '}
                  <a href="sms:+16199713730" className="text-[#A59480] hover:underline">
                    (619) 971-3730
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to manually report errors
 */
export function useErrorReporter() {
  const reportError = React.useCallback((error: Error, context?: Record<string, any>) => {
    errorLogger.error('Manual error report', error, {
      ...context,
      page: window.location.pathname,
    });
  }, []);

  return { reportError };
}
