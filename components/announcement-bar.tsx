import { ANNOUNCEMENT_MESSAGES, FREE_STANDARD_DELIVERY } from "@/lib/storefront-copy"

const SLOT_SECONDS = 4

/**
 * Rotating announcement, pure CSS (no client JS). Each message fades in for one slot.
 * The pause control is a native checkbox: :has(:checked) pauses the rotation (WCAG 2.2.2).
 * Under reduced motion only the first message shows, without rotation.
 */
export function AnnouncementBar() {
  const messages = [
    FREE_STANDARD_DELIVERY,
    ...ANNOUNCEMENT_MESSAGES.filter(message => message !== FREE_STANDARD_DELIVERY),
  ]
  const n = messages.length
  const slot = 100 / n
  // Keyframes depend on the message count, so they are generated here (static, no user input).
  const keyframes = `@keyframes announce-${n}{0%{opacity:0;translate:0 6px}${(slot * 0.12).toFixed(2)}%{opacity:1;translate:0 0}${(slot * 0.88).toFixed(2)}%{opacity:1;translate:0 0}${slot.toFixed(2)}%{opacity:0;translate:0 -6px}100%{opacity:0;translate:0 -6px}}`

  return (
    <div className="announce relative bg-navy-deep text-on-dark">
      <style>{keyframes}</style>
      <div className="mx-auto flex h-9 max-w-7xl items-center gap-2 px-3 sm:px-5 lg:px-8">
        <span className="size-8 shrink-0" aria-hidden />
        <ul aria-label="Store announcements" className="relative h-full flex-1 overflow-hidden text-center">
          {messages.map((msg, i) => (
            <li
              key={msg}
              className="announce-item absolute inset-0 flex items-center justify-center text-[11px] font-medium uppercase tracking-[0.18em]"
              style={{
                animationName: `announce-${n}`,
                animationDuration: `${n * SLOT_SECONDS}s`,
                animationDelay: `${i * SLOT_SECONDS}s`,
              }}
            >
              {msg}
            </li>
          ))}
        </ul>
        <label className="announce-pause relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-on-dark/80 hover:text-on-dark">
          <input type="checkbox" className="peer absolute inset-0 cursor-pointer opacity-0" aria-label="Pause announcements" />
          {/* Pause bars when running, play triangle when paused */}
          <svg viewBox="0 0 12 12" aria-hidden className="size-3 peer-checked:hidden">
            <rect x="2.5" y="2" width="2.2" height="8" fill="currentColor" />
            <rect x="7.3" y="2" width="2.2" height="8" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 12 12" aria-hidden className="hidden size-3 peer-checked:block">
            <path d="M3 2l7 4-7 4z" fill="currentColor" />
          </svg>
        </label>
      </div>
    </div>
  )
}
