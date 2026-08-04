"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

/**
 * Small form primitives shared by the campaign builder popups.
 *
 * These exist so the two campaign forms stop hand-rolling Chakra FormControl /
 * NumberInput / RadioGroup markup and instead share one mobile-first layout.
 * Every interactive element here is at least 44px tall, which is the minimum
 * comfortable touch target, and every control is full-width by default so
 * nothing gets squeezed into an unusable column on a phone.
 *
 * The design system has no radio-group component and `@radix-ui/react-radio-group`
 * is not a dependency, so RadioCardGroup below is built on native radio inputs.
 * Native inputs also give us free keyboard and screen-reader behaviour.
 */

/**
 * Weekday values match the `INTEGER[]` columns in the database (0 = Sunday).
 * Shared so the two campaign forms cannot drift apart if one is edited alone.
 */
export const WEEKDAY_OPTIONS = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
]

const controlBase =
  "w-full min-h-[44px] rounded-md border border-[#a59480] bg-white px-3 py-2 text-base text-[#353535] " +
  "placeholder:text-[#9a9385] focus:outline-none focus:ring-2 focus:ring-[#a59480] focus:border-[#a59480] " +
  "disabled:cursor-not-allowed disabled:opacity-50"

/** Section heading inside the form body. */
export function FormSection({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title ? (
        <h3 className="text-base font-bold text-[#a59480] sm:text-lg">{title}</h3>
      ) : null}
      {children}
    </section>
  )
}

/**
 * Id of the current Field's label, for controls that cannot be associated with
 * one via `htmlFor`.
 *
 * `<label htmlFor>` only binds to a single labelable form control — it does
 * nothing for a `role="radiogroup"` or `role="group"` container. Without this,
 * every recurring-schedule, timing-type and monthly-type group in the campaign
 * forms is announced with no name at all. Groups read it and set
 * `aria-labelledby` themselves, so callers get the association for free.
 */
const FieldLabelContext = React.createContext<string | undefined>(undefined)

/** Label + control + optional hint/error, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  labelAction,
  children,
  className,
}: {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  /**
   * Control rendered beside the label — e.g. a help toggle. Kept as a sibling
   * of the <label> rather than inside it: `ui/label.tsx` is a plain <label>,
   * and a nested <button> is invalid per the HTML content model, with
   * inconsistent screen-reader and label-click behaviour across browsers.
   */
  labelAction?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const labelId = `${React.useId()}-label`

  return (
    <FieldLabelContext.Provider value={label ? labelId : undefined}>
      <div className={cn("space-y-1.5", className)}>
        {label ? (
          <div className="flex items-center gap-2">
            <Label
              id={labelId}
              htmlFor={htmlFor}
              className="block text-sm font-medium text-[#a59480]"
            >
              {label}
              {required ? <span className="ml-0.5 text-[#C84B31]">*</span> : null}
            </Label>
            {labelAction}
          </div>
        ) : null}
        {children}
        {error ? (
          <p className="text-sm text-[#C84B31]">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#6b6b5f]">{hint}</p>
        ) : null}
      </div>
    </FieldLabelContext.Provider>
  )
}

/**
 * Rows that were `HStack`s in the Chakra version. They collapse to a single
 * column on phones — the old layout put up to four inputs side by side inside
 * a drawer only a couple of hundred pixels wide.
 */
export function FieldRow({
  children,
  className,
  cols = 2,
}: {
  children: React.ReactNode
  className?: string
  cols?: 1 | 2 | 3
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  )
}

export const TextField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlBase, className)} {...props} />
))
TextField.displayName = "TextField"

export const TextAreaField = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlBase, "min-h-[120px] resize-y leading-relaxed", className)}
    {...props}
  />
))
TextAreaField.displayName = "TextAreaField"

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(controlBase, "pr-8", className)} {...props}>
    {children}
  </select>
))
SelectField.displayName = "SelectField"

/**
 * Number entry with explicit -/+ buttons, replacing Chakra's NumberInput.
 * The stepper arrows Chakra renders are ~10px tall and effectively untappable
 * on a touch screen; these are 44px.
 */
export function NumberField({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  id,
  placeholder,
  className,
}: {
  value: number | undefined
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  id?: string
  placeholder?: string
  className?: string
}) {
  const current = Number.isFinite(value as number) ? (value as number) : min

  const clamp = (next: number) => Math.min(max, Math.max(min, next))

  // The visible text is tracked separately from the committed number so the
  // field can sit empty mid-edit. Deriving it straight from `value` meant a
  // select-all + delete produced NaN, which we could only ignore — and because
  // the input is controlled, React immediately painted the old digits back, so
  // clearing the field was impossible.
  const [text, setText] = React.useState(() =>
    value != null ? String(value) : ""
  )

  const textRef = React.useRef(text)
  textRef.current = text

  React.useEffect(() => {
    // Re-sync when the value changes from outside this input: the -/+ buttons,
    // a form reset, or loading an existing template. Skipped when the text on
    // screen already represents the incoming value, so typing is never
    // interrupted to rewrite what the user is in the middle of.
    if (value != null && parseInt(textRef.current, 10) === value) return
    setText(value != null ? String(value) : "")
  }, [value])

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(clamp(current - step))}
        disabled={current <= min}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-[#a59480] bg-white text-lg font-medium text-[#353535] disabled:opacity-40"
      >
        &minus;
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          // An empty field is a valid intermediate state; leave the committed
          // value alone until the user types a number.
          const parsed = parseInt(raw, 10)
          if (Number.isNaN(parsed)) return
          // NEITHER bound is applied per keystroke. Clamping mid-type makes the
          // field fight the user, and the lower bound is just as guilty as the
          // upper: with min=10, typing "12" clamps the first keystroke's "1" to
          // 10, the re-sync effect sees text "1" against value 10 and rewrites
          // the field to "10" before the second digit ever lands.
          //
          // Both bounds are applied on blur instead, which always runs before a
          // Save click (blur precedes click), so an out-of-range value cannot be
          // submitted.
          onChange(parsed)
        }}
        onBlur={() => {
          // Settle the field: apply the upper bound and normalise the display.
          // This also covers an empty field and input that parses to the value
          // already committed ("5" -> "05"), where `value` never changes and the
          // re-sync effect would not fire on its own.
          const parsed = parseInt(text, 10)
          if (Number.isNaN(parsed)) {
            setText(value != null ? String(value) : "")
            return
          }
          const settled = clamp(parsed)
          if (settled !== value) onChange(settled)
          setText(String(settled))
        }}
        className={cn(controlBase, "text-center")}
      />
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(clamp(current + step))}
        disabled={current >= max}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-[#a59480] bg-white text-lg font-medium text-[#353535] disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

export interface RadioCardOption {
  value: string
  label: string
  description?: string
}

/**
 * Full-width tappable rows, one per option. Replaces Chakra's Radio/RadioGroup.
 */
export function RadioCardGroup({
  name,
  value,
  onChange,
  options,
  className,
}: {
  name: string
  value: string | undefined
  onChange: (value: string) => void
  options: RadioCardOption[]
  className?: string
}) {
  const labelledBy = React.useContext(FieldLabelContext)

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn("space-y-2", className)}
    >
      {options.map((option) => {
        const checked = value === option.value
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
              checked
                ? "border-[#a59480] bg-[#a59480]/15"
                : "border-[#d8d4cb] bg-white hover:bg-[#f4f3ef]"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              // min-h/min-w are explicit because globals.css forces
              // `min-height: 44px; min-width: 44px` on every input under 768px,
              // which would otherwise inflate the dot to the size of the row.
              className="mt-0.5 h-5 w-5 min-h-[1.25rem] min-w-[1.25rem] flex-shrink-0 border-[#a59480] text-[#a59480] focus:ring-[#a59480]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#353535]">
                {option.label}
              </span>
              {option.description ? (
                <span className="block text-xs text-[#6b6b5f]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * Multi-select chips. Used for weekday pickers, which were a vertical list of
 * seven Chakra checkboxes — a lot of scrolling on a phone for seven values.
 */
export function ToggleChipGroup({
  value,
  onChange,
  options,
  className,
}: {
  value: string[]
  onChange: (value: string[]) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  const toggle = (next: string) => {
    onChange(
      value.includes(next)
        ? value.filter((v) => v !== next)
        : [...value, next]
    )
  }

  const labelledBy = React.useContext(FieldLabelContext)

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option.value)}
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-[#a59480] bg-[#a59480] text-[#ECEDE8]"
                : "border-[#d8d4cb] bg-white text-[#353535] hover:bg-[#f4f3ef]"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Full-width checkbox row with a 44px target. */
export function CheckboxRow({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        // See the note on RadioCardGroup: globals.css forces a 44px minimum on
        // inputs below 768px, so the box needs an explicit min size.
        className="mt-0.5 h-5 w-5 min-h-[1.25rem] min-w-[1.25rem] flex-shrink-0 rounded border-[#a59480] text-[#a59480] focus:ring-[#a59480]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-[#353535]">{label}</span>
        {description ? (
          <span className="block text-xs text-[#6b6b5f]">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

/** Cancel / Save pair for the dialog footer. Stacks on the narrowest phones. */
export function DialogActions({
  onCancel,
  onSave,
  saveLabel,
  isSaving,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void
  onSave: () => void
  saveLabel: string
  isSaving?: boolean
  cancelLabel?: string
}) {
  return (
    // Side by side even on the narrowest phone: two ~170px buttons are still
    // comfortable targets, and stacking them would cost ~56px of the vertical
    // space the form needs.
    <div className="flex flex-row gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="min-h-[44px] flex-1 rounded-md border border-[#353535] px-4 text-sm font-medium text-[#353535] transition-colors hover:bg-[#e2e1db]"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="min-h-[44px] flex-1 rounded-md bg-[#a59480] px-4 text-sm font-medium text-[#ECEDE8] transition-colors hover:bg-[#8a7a6a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving…" : saveLabel}
      </button>
    </div>
  )
}
