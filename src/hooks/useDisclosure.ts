import { useState, useCallback } from "react";

/**
 * useDisclosure - Simple replacement for Chakra UI's useDisclosure
 * Manages open/close state for modals, drawers, etc.
 */
export function useDisclosure(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const onOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    onOpen,
    onClose,
    onToggle,
  };
}
