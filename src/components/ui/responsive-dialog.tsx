"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A dialog that fills the screen on phones and centres as a popup from `sm` up,
 * for forms too long to fit in a viewport.
 *
 * `ui/dialog.tsx` cannot do this: it hardcodes a centred `max-w-lg` container
 * with `p-4`, so its content can never go edge to edge, and it bounds nothing
 * vertically — a tall form simply grows past the viewport with no scroll. That
 * is the bug this exists to fix. Measured on the campaign builder before the
 * change: 1398px of content inside an 844px fixed container, the body
 * reporting `scrollHeight === clientHeight`, everything past the fold
 * unreachable because a `position: fixed` container never extends the page's
 * own scroll range.
 *
 * The layout contract is the whole fix:
 *   - the panel is a flex column that is never taller than the viewport
 *   - the header and footer are fixed-size and always visible
 *   - the body is the single scroll surface
 *
 * Sized in `dvh` rather than `vh`, so mobile browser chrome is excluded.
 *
 * This wraps the Radix primitive directly, which `.claude/preferences.md`
 * reserves for `ui/` wrappers — the same thing `ui/dialog.tsx` and
 * `ui/sheet.tsx` already do. Feature code should import this, never the
 * primitive.
 */
export interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  /** Rendered in the pinned footer. Usually a Cancel / Save pair. */
  footer?: React.ReactNode
  /**
   * Set false while a nested dialog is open, so a click or Escape lands on that
   * dialog instead of tearing down the form behind it.
   */
  dismissable?: boolean
  /** Applied to the panel, for per-feature colours and borders. */
  className?: string
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
  className,
}: ResponsiveDialogProps) {
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
              "focus:outline-none",
              className
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
                  // Radix warns when Content has no Description. This
                  // deliberately repeats the title rather than inventing prose;
                  // pass `description` to give screen readers something better.
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
                chaining out to the page behind. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 [-webkit-overflow-scrolling:touch]">
              {children}
            </div>

            {/* Footer — pinned, and padded clear of the iOS home indicator.
                That padding depends on the `viewport-fit=cover` viewport meta
                in pages/_app.tsx; without it env() resolves to 0. */}
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

export default ResponsiveDialog
