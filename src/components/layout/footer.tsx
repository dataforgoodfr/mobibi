export function Footer() {
  return (
    <footer className="mt-[var(--section-y)] border-t-[length:var(--bd-w)] border-ink bg-ink text-paper">
      <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-start gap-7 px-6 py-11">
        <div className="min-w-60">
          <div className="text-[1.9rem] font-extrabold tracking-[-0.04em]">
            mob<span className="text-accent">i</span>b<span className="text-accent-2">i</span>
          </div>
          <p className="max-w-80 text-[0.9rem] leading-normal opacity-80">
            On rassemble les citoyen·nes autour des causes qui comptent. Une voix, ça compte. Des
            milliers, ça pèse.
          </p>
        </div>
        <div className="flex-1" />
        <div className="text-sm leading-loose opacity-85">
          <div className="mb-1 font-extrabold opacity-100">Le projet</div>
          Mobilisations · Associations · Manifeste
        </div>
        <div className="text-sm leading-loose opacity-85">
          <div className="mb-1 font-extrabold opacity-100">Pratique</div>
          RGPD · Mentions légales · Contact
        </div>
      </div>
      <div className="border-t border-white/15 px-6 py-4 text-center text-[0.78rem] opacity-60">
        mobibi {new Date().getFullYear()}.
      </div>
    </footer>
  )
}
