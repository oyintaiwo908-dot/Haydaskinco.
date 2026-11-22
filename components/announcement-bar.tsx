import { ANNOUNCEMENT_MESSAGES } from "@/lib/storefront-copy"

/** Pre-redesign scroll speed (9ea0dd0, measured at 1440px wide): 24px per second, leftwards. */
const PX_PER_SECOND = 24
/** Rough width of one message set: 11px uppercase with 0.18em tracking, plus 64px margins. */
const estimateWidth = (messages: readonly string[]) =>
  messages.reduce((sum, m) => sum + m.length * 8.6 + 64, 0)

/**
 * Announcement bar: a continuous horizontal scroll, as before the redesign (commit 9ea0dd0),
 * pure CSS. Two copies of the messages slide left forever; one copy is hidden from assistive
 * tech. The old version translated by half the bar's width, so it jumped at each loop and
 * crawled on phones; this one moves exactly one copy for a seamless loop at the old desktop
 * speed. No pause button (client decision). It pauses on hover and on keyboard focus (the bar
 * is focusable for that reason) and does not move at all under reduced motion, where only the
 * first message shows.
 */
export function AnnouncementBar() {
  const messages = [...ANNOUNCEMENT_MESSAGES]
  const seconds = Math.round(estimateWidth(messages) / PX_PER_SECOND)
  const list = (hidden: boolean) => (
    <ul className="announce-list flex shrink-0 items-center" aria-hidden={hidden || undefined} aria-label={hidden ? undefined : "Store announcements"}>
      {messages.map(msg => (
        <li key={msg} className="announce-item mx-8 shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em]">
          {msg}
        </li>
      ))}
    </ul>
  )

  return (
    <div
      className="announce relative overflow-hidden bg-navy-deep text-on-dark"
      tabIndex={0}
      role="region"
      aria-label="Announcements (focus or hover to pause)"
    >
      <div className="announce-track flex h-9 w-max items-center" style={{ animationDuration: `${seconds}s` }}>
        {list(false)}
        {list(true)}
      </div>
    </div>
  )
}
