import * as React from "react"

import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

/** The variants `toastVariants` in components/ui/toast.tsx actually defines. */
type ToastVariant = "default" | "success" | "error" | "warning" | "info"

const KNOWN_VARIANTS = new Set<string>([
  "default",
  "success",
  "error",
  "warning",
  "info",
])

/** Spellings used by callers that don't match a defined variant. */
const VARIANT_ALIASES: Record<string, ToastVariant> = {
  destructive: "error",
}

/**
 * useToast - Toast hook compatible with Chakra UI's useToast API
 *
 * Usage (Chakra-compatible):
 * ```tsx
 * const toast = useToast()
 *
 * toast({ title: "Success", status: "success" })
 * toast({ title: "Error", description: "Something went wrong", status: "error" })
 * ```
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  // Chakra-compatible toast function
  const toast = React.useCallback(
    (props: Toast & { status?: "success" | "error" | "warning" | "info" }) => {
      const { status, variant: variantProp, title, description, ...rest } = props
      const id = genId()

      const update = (props: ToasterToast) =>
        dispatch({
          type: "UPDATE_TOAST",
          toast: { ...props, id },
        })
      const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

      // Map Chakra's status prop to our variant prop.
      //
      // `variant` is destructured out above and considered here rather than
      // being left to ride along in `...rest`. Previously it stayed in `rest`,
      // which is spread *before* this computed key in the dispatch below — so a
      // caller passing `variant: 'error'` had it silently overwritten with
      // "default" and got an unstyled grey toast. Around fifteen files across
      // the app pass `variant:` and were all affected.
      //
      // `status` still wins when both are given, keeping the documented
      // Chakra-compatible API authoritative.
      //
      // The value is then normalised against what `toastVariants` actually
      // defines. This matters because honoring `variant` at all is what makes
      // an unrecognised value reachable: cva contributes NO classes for a value
      // outside its map (defaultVariants only apply when the prop is
      // undefined), so passing one through renders a completely unstyled toast
      // — worse than the grey it used to get clobbered into. `destructive` is
      // the shadcn spelling of `error` and is aliased rather than dropped;
      // anything else unrecognised degrades to "default".
      const requested = status || variantProp
      const variant: ToastVariant = requested
        ? VARIANT_ALIASES[requested] ??
          (KNOWN_VARIANTS.has(requested) ? (requested as ToastVariant) : "default")
        : "default"

      dispatch({
        type: "ADD_TOAST",
        toast: {
          ...rest,
          id,
          title,
          description,
          variant,
          open: true,
          onOpenChange: (open: boolean) => {
            if (!open) dismiss()
          },
        },
      })

      return {
        id: id,
        dismiss,
        update,
      }
    },
    []
  )

  return {
    toast,
    toasts: state.toasts,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast }
