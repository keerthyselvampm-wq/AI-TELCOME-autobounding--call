export function CardSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 animate-pulse">
      <div className="h-5 w-1/3 bg-gray-200 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full bg-gray-200 rounded" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-200">
        <div className="h-5 w-1/4 bg-gray-200 rounded" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-4 flex-1 bg-gray-200 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-7 w-16 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-5 w-1/4 bg-gray-200 rounded mb-6" />
      <div className="h-64 w-full bg-gray-200 rounded-lg" />
    </div>
  )
}
