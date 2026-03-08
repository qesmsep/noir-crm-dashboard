import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, VStack, Text, HStack, Icon } from '@chakra-ui/react';
import { RotateCcw } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureComplete: (signatureDataUrl: string) => void;
  disabled?: boolean;
}

export default function SignatureCanvas({ onSignatureComplete, disabled = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

  // Canvas internal resolution
  const CANVAS_WIDTH = 600;
  const CANVAS_HEIGHT = 300;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal dimensions
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Configure drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, []);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.Touch) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX;
    const clientY = e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const { x, y } = getCanvasCoordinates(e);
    setIsDrawing(true);
    setLastX(x);
    setLastY(y);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    setLastX(x);
    setLastY(y);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Export signature as base64 PNG
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureComplete(dataUrl);
    }
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch);
    setIsDrawing(true);
    setLastX(x);
    setLastY(y);
    setHasSignature(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    setLastX(x);
    setLastY(y);
  };

  const handleTouchEnd = () => {
    stopDrawing();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // Clear canvas and refill with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    setHasSignature(false);
    setIsDrawing(false);
    onSignatureComplete('');
  };

  return (
    <VStack spacing={3} align="stretch" w="100%">
      {/* Canvas */}
      <Box
        position="relative"
        w="100%"
        maxW="600px"
        mx="auto"
        borderRadius="md"
        overflow="hidden"
        boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
        border="2px dashed"
        borderColor={isDrawing ? 'blue.400' : 'gray.300'}
        bg="white"
        opacity={disabled ? 0.5 : 1}
        cursor={disabled ? 'not-allowed' : 'crosshair'}
        sx={{
          '& canvas': {
            width: '100% !important',
            height: 'auto !important',
            display: 'block'
          }
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: 'none' // Prevent scrolling on mobile
          }}
        />
      </Box>

      {/* Instructions & Clear button */}
      <HStack justify="space-between" align="center">
        <Text fontSize="sm" color="gray.600">
          Sign above with your finger or mouse
        </Text>
        <Button
          size="sm"
          variant="outline"
          colorScheme="gray"
          leftIcon={<Icon as={RotateCcw} />}
          onClick={clearSignature}
          isDisabled={!hasSignature || disabled}
        >
          Clear
        </Button>
      </HStack>
    </VStack>
  );
}
