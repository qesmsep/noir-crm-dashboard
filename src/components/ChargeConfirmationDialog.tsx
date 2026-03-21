"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface ChargeConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  memberName?: string;
  description?: string;
}

export function ChargeConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  amount,
  memberName,
  description
}: ChargeConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-white border border-[#ECEAE5] rounded-2xl max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-[#1F1F1F]">
            Hold Up!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[#5A5A5A] mt-2">
            You're about to charge {memberName || 'this member'}{' '}
            <span className="font-semibold text-[#1F1F1F]">
              ${amount.toFixed(2)}
            </span>
            {description && (
              <>
                {' '}for: <span className="font-medium">"{description}"</span>
              </>
            )}
            <br /><br />
            Please confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
          <AlertDialogCancel
            className="bg-white border border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F7F6F2] hover:border-[#A59480] rounded-[10px] px-4 min-h-[44px] font-semibold transition-all duration-200"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#A59480] hover:bg-[#8C7C6D] text-white rounded-[10px] px-4 min-h-[44px] font-semibold transition-all duration-200 shadow-[0_1px_2px_rgba(165,148,128,0.15),0_4px_8px_rgba(165,148,128,0.25),0_8px_16px_rgba(165,148,128,0.18)] hover:shadow-[0_2px_4px_rgba(165,148,128,0.1),0_8px_16px_rgba(165,148,128,0.15),0_16px_32px_rgba(165,148,128,0.12)] hover:-translate-y-0.5 mt-2 sm:mt-0"
          >
            Confirm Charge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
