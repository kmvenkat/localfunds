import { formatBig, formatProgramAmount } from '../../lib/formatBig.js'

function getProgramStatus(program) {
  if (program.estimated) {
    return { label: 'Estimated', colorClass: 'text-proposed', dotClass: 'bg-proposed' }
  }
  if (!program.amount || program.amount === 0) {
    return { label: 'No data', colorClass: 'text-ink-light', dotClass: 'bg-border' }
  }
  if (program.status === 'cut') {
    return { label: 'Cut', colorClass: 'text-cut', dotClass: 'bg-cut' }
  }
  if (program.status === 'proposed') {
    return { label: 'At risk', colorClass: 'text-proposed', dotClass: 'bg-proposed' }
  }
  if (program.status === 'frozen') {
    return { label: 'Frozen', colorClass: 'text-proposed', dotClass: 'bg-proposed' }
  }
  return null
}

function shortenDataNote(note) {
  if (!note) return ''
  const first = note.split('. ')[0]
  return first.endsWith('.') ? first : `${first}.`
}

function isEmptyPrograms(programs) {
  if (!programs?.length) return true
  return programs.every((p) => p.amount === 0)
}

function FixedStatusColumn({ status }) {
  if (!status) {
    return <div className="w-[90px] sm:w-[130px]" />
  }
  return (
    <div className="flex w-[90px] items-center gap-1 sm:w-[130px] sm:gap-1.5">
      <div
        className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${status.dotClass}`}
      />
      <span className={`text-[10px] font-medium sm:text-xs ${status.colorClass}`}>
        {status.label}
      </span>
    </div>
  )
}

function FixedAmountColumn({ children }) {
  return (
    <div className="flex w-[90px] flex-col items-end sm:w-[140px]">{children}</div>
  )
}

function ProgramListSkeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="min-h-[56px] border-b border-border bg-surface pl-6 last:border-0 sm:min-h-[64px] sm:pl-10"
        >
          <div className="flex h-full items-center pr-3 sm:pr-6">
            <div className="h-5 flex-1 animate-pulse rounded bg-accent-lt" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ExpandedProgramRow({ program, index, onOpenModal }) {
  const status = getProgramStatus(program)
  const rowBg = index % 2 === 0 ? 'bg-surface' : 'bg-accent-lt'
  const amountColor = program.estimated
    ? 'italic text-ink-light'
    : 'font-semibold text-accent'
  const showWhyNoData = program.amount === 0 && program.noDataReason
  const methodologyLabel = showWhyNoData ? 'Why no data?' : 'How we calculate this'

  return (
    <div
      className={`flex min-h-[56px] items-start border-b border-border py-2 pl-6 pr-3 sm:min-h-[64px] sm:pl-10 sm:pr-6 ${rowBg}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center pr-2">
        <p className="text-sm font-semibold leading-snug text-ink">{program.name}</p>
        {program.description && (
          <p className="mt-0.5 hidden text-xs leading-relaxed text-ink-light sm:block">
            {program.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-start pt-2 pr-[20px] sm:pt-3 sm:pr-[24px]">
        <FixedStatusColumn status={status} />
        <FixedAmountColumn>
          <span className={`text-xs sm:text-sm ${amountColor}`}>
            {formatProgramAmount(program.amount)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenModal(program)
            }}
            className="mt-1 hidden text-[10px] font-medium text-accent hover:underline sm:block"
          >
            {methodologyLabel}
          </button>
        </FixedAmountColumn>
      </div>
    </div>
  )
}

function RowHeader({
  icon: Icon,
  label,
  query,
  isOpen,
  rowBg,
  onToggle,
  showShortNote,
  shortNote,
}) {
  const accentText = isOpen ? 'text-accent' : 'text-ink'
  const collapsedAmountClass =
    query.isError || query.data?.total === 0 ? 'text-ink-light' : 'text-accent'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full cursor-pointer items-center border-b border-border text-left transition-colors duration-100 ${
        isOpen
          ? 'min-h-[72px]'
          : `min-h-[64px] py-3 hover:bg-accent-lt sm:min-h-[72px] sm:py-4 ${rowBg}`
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center pl-6">
        <Icon
          size={18}
          strokeWidth={1.75}
          className={`mr-3 shrink-0 ${isOpen ? 'text-accent' : 'text-ink-light'}`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${accentText}`}>{label}</p>
          {showShortNote && (
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink-light sm:line-clamp-none">
              ⓘ {shortNote}
            </p>
          )}
        </div>
      </div>
      {isOpen ? (
        <div className="flex shrink-0 items-center pr-3 sm:pr-6">
          <FixedStatusColumn status={null} />
          <FixedAmountColumn>
          {query.isLoading && (
            <div className="h-5 w-20 animate-pulse rounded bg-accent-lt" />
          )}
          {query.isError && (
            <span className="text-base font-bold text-ink-light">—</span>
          )}
          {!query.isLoading && !query.isError && query.data && (
            <span className="text-base font-bold text-accent">
                {formatBig(query.data.total)}
            </span>
          )}
          </FixedAmountColumn>
          <span className="ml-4 shrink-0 text-sm text-accent" aria-hidden>
            v
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-4 pr-6">
          {query.isLoading && (
            <div className="h-5 w-20 animate-pulse rounded bg-accent-lt" />
          )}
          {query.isError && (
            <span className="text-base font-semibold text-ink-light">—</span>
          )}
          {!query.isLoading && !query.isError && query.data && (
            <span className={`text-base font-semibold ${collapsedAmountClass}`}>
              {formatBig(query.data.total)}
            </span>
          )}
          <span className="text-sm text-ink-light" aria-hidden>
            ›
          </span>
        </div>
      )}
    </button>
  )
}

export default function AccordionRow({
  icon,
  label,
  slug: _slug,
  query,
  isOpen,
  onToggle,
  onOpenModal,
  index,
}) {
  const rowBg = index % 2 === 0 ? 'bg-surface' : 'bg-bg'
  const programs = query.data?.programs ?? []
  const showEmptyPrograms = !query.isLoading && !query.isError && isEmptyPrograms(programs)
  const dataNote = query.data?.dataNote
  const showShortNote =
    !isOpen && dataNote && query.data?.total > 0 && !query.isLoading
  const shortNote = showShortNote ? shortenDataNote(dataNote) : ''

  if (!isOpen) {
    return (
      <RowHeader
        icon={icon}
        label={label}
        query={query}
        isOpen={false}
        rowBg={rowBg}
        onToggle={onToggle}
        showShortNote={showShortNote}
        shortNote={shortNote}
      />
    )
  }

  return (
    <div className="border-b border-border border-l-[3px] border-l-accent bg-accent-lt">
      <RowHeader
        icon={icon}
        label={label}
        query={query}
        isOpen
        rowBg={rowBg}
        onToggle={onToggle}
        showShortNote={false}
        shortNote=""
      />

      <div className="mx-4 border-b border-border" />

      {query.isLoading && <ProgramListSkeleton />}

      {query.isError && (
        <p className="py-4 pl-6 text-sm italic text-ink-light sm:pl-10">
          Unable to load programs.
        </p>
      )}

      {!query.isLoading && !query.isError && showEmptyPrograms && (
        <p className="py-4 pl-6 text-sm italic text-ink-light sm:pl-10">
          No program-level data available for this county.
        </p>
      )}

      {!query.isLoading && !query.isError && !showEmptyPrograms && (
        <div>
          {programs.map((program, i) => (
            <ExpandedProgramRow
              key={program.id}
              program={program}
              index={i}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>
      )}

      {dataNote && (
        <div className="bg-[#e0ebff] px-6 py-2 sm:px-10">
          <p className="text-[11px] text-ink-light">ⓘ {dataNote}</p>
        </div>
      )}
    </div>
  )
}
