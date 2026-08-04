"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Popup shell for the campaign builder.
 *
 * Replaces the Chakra right-side Drawer that CampaignDrawer and
 * CampaignTemplateDrawer used to render, which was unusable on phones:
 *  - it asked for `w="50vw"` while global CSS forced `width: auto !important`
 *  - it sat under an `mt="80px"` offset while global CSS forced a
 *    full-viewport height pinned to `top: 0`, so the footer holding the Save
 *    button rendered below the fold with no way to scroll to it
 *  - `--vh` (which those global rules depend on) is never set on /admin pages,
 *    because ViewportHeightProvider is only mounted in the App Router layout
 *
 * This is built directly on the Radix dialog primitive rather than on
 * components/ui/dialog.tsx, because that wrapper hardcodes a centered
 * `max-w-lg` container with `p-4`, which cannot become a full-screen mobile
 * sheet. Building on the primitive keeps this change scoped to the campaign
 * builder with no risk to the ~20 other screens using the shared Dialog.
 *
 * Layout contract — this is the whole fix:
 *   - the panel is a flex column that is never taller than the viewport
 *   - the header and footer are fixed-size and always visible
 *   - the body is the single scroll surface
 *
 * Sizing uses `dvh`, not `vh`, so mobile browser chrome (the URL bar) is
 * excluded and nothing is clipped.
 *
 * If this works well, it is the intended pattern for the other drawers in the
 * app (reservations, events, reminders, questionnaires), which share the same
 * defects.
 */
export interface CampaignBuilderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  /** Rendered in the pinned footer. Usually the Cancel / Save button pair. */
  footer?: React.ReactNode
  /**
   * Set while a nested confirmation dialog is open, so a click or Escape lands
   * on that dialog instead of tearing down the whole form behind it.
   */
  dismissable?: boolean
}

export function CampaignBuilderDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
}: CampaignBuilderDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[1000] bg-black/60",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />

        {/* Positioning layer. Full-bleed on phones, padded and centred from
            `sm` up. Fixed + inset-0 with dvh keeps it inside the visual
            viewport instead of under the mobile browser chrome. */}
        <div className="fixed inset-0 z-[1001] flex items-stretch justify-center sm:items-center sm:p-6 pointer-events-none">
          <DialogPrimitive.Content
            onInteractOutside={(e) => {
              if (!dismissable) e.preventDefault()
            }}
            onEscapeKeyDown={(e) => {
              if (!dismissable) e.preventDefault()
            }}
            className={cn(
              "pointer-events-auto relative flex w-full flex-col overflow-hidden bg-[#ecede8] text-[#353535] shadow-2xl",
              // Phones: edge-to-edge sheet at the true visible viewport height.
              "h-[100dvh] max-h-[100dvh]",
              // Tablet and up: a centred popup that never exceeds the viewport.
              "sm:h-auto sm:max-h-[88dvh] sm:max-w-[720px] sm:rounded-xl sm:border-2 sm:border-[#353535]",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "focus:outline-none"
            )}
          >
            {/* Header — fixed size, never scrolls away. */}
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[#a59480] px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="truncate text-xl font-bold text-[#353535] sm:text-2xl">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-0.5 text-sm text-[#6b6b5f]">
                    {description}
                  </DialogPrimitive.Description>
                ) : (
                  // Radix warns when Content has no Description; this satisfies
                  // it without rendering anything visible.
                  <DialogPrimitive.Description className="sr-only">
                    {title}
                  </DialogPrimitive.Description>
                )}
              </div>

              <DialogPrimitive.Close
                aria-label="Close"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[#353535] text-[#ECEDE8] transition-colors hover:bg-[#2a2a2a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a59480]"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Body — the ONLY scroll surface. `min-h-0` is what allows a flex
                child to shrink below its content size and actually scroll.
                `overscroll-contain` stops a scroll at the end of the form from
                chaining out to the page behind the dialog. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 [-webkit-overflow-scrolling:touch]">
              {children}
            </div>

            {/* Footer — pinned, and padded clear of the iOS home indicator. */}
            {footer ? (
              <div
                className="flex-shrink-0 border-t border-[#a59480] bg-[#ecede8] px-4 pt-4 sm:px-6"
                style={{
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                {footer}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default CampaignBuilderDialog
