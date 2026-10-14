/**
 * Cause words are hardcoded, same as the design handoff (`app/Home.jsx`) — no
 * collection backs them; revisit if a cause taxonomy is ever needed.
 */
const CAUSES = [
  'Sans pesticides',
  'Air pur',
  'Bien-être animal',
  'Climat',
  'Eau potable',
  'Biodiversité',
  'Justice sociale',
]

export function Marquee() {
  const row = [...CAUSES, ...CAUSES]

  return (
    <div className="mt-10 overflow-hidden border-y-[length:var(--bd-w)] border-ink bg-accent-2">
      <div className="marquee-track flex gap-0 py-3 whitespace-nowrap">
        {row.map((word, i) => (
          <span
            key={i}
            className="font-display inline-flex items-center gap-5.5 px-5.5 text-xl font-extrabold tracking-[0.02em] text-ink uppercase"
          >
            {word}
            <span aria-hidden className="size-2.5 rounded-full bg-accent" />
          </span>
        ))}
      </div>
    </div>
  )
}
