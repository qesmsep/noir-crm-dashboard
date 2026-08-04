"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"

/**
 * Confirmation dialog that stacks above CampaignBuilderDialog.
 *
 * Built on the Radix primitive rather than components/ui/alert-dialog.tsx for
 * a stacking reason, not a styling one. That wrapper renders its overlay and a
 * `fixed inset-0 z-50` positioning div internally and only forwards `className`
 * to the innermost Content. Because the positioning div is `position: fixed`
 * with its own z-index, it opens a new stacking context — a z-index on its
 * child cannot escape to compete with CampaignBuilderDialog's z-[1000]/z-[1001]
 * portal siblings. The net effect was a confirmation that mounted *behind* the
 * still-opaque builder panel, so "Delete Template" looked like it did nothing.
 *
 * Here every layer is explicit and sits above the builder.
 */
export interface CampaignConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  /** Styles the confirm button for an irreversible action. */
  destructive?: boolean
}

export function CampaignConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
}: CampaignConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        {/* Above the builder's overlay (z-1000) and panel (z-1001). */}
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[1100] bg-black/60",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <div className="fixed inset-0 z-[1101] flex items-center justify-center p-4">
          <AlertDialogPrimitive.Content
            className={cn(
              "relative w-full max-w-md rounded-xl border border-[#a59480] bg-[#ecede8] p-5 shadow-2xl",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "focus:outline-none"
            )}
          >
            <AlertDialogPrimitive.Title className="text-lg font-bold text-[#353535]">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm text-[#6b6b5f]">
              {description}
            </AlertDialogPrimitive.Description>

            <div className="mt-5 flex flex-row gap-3">
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  className="min-h-[44px] flex-1 rounded-md border border-[#353535] px-4 text-sm font-medium text-[#353535] transition-colors hover:bg-[#e2e1db]"
                >
                  {cancelLabel}
                </button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-md px-4 text-sm font-medium text-white transition-colors",
                    destructive
                      ? "bg-[#ef4444] hover:bg-[#dc2626]"
                      : "bg-[#a59480] hover:bg-[#8a7a6a]"
                  )}
                >
                  {confirmLabel}
                </button>
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </div>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

export default CampaignConfirmDialog
