export function ProductCardSkeleton() {
  return (
    <div className="card p-4 animate-pulse flex flex-col">
      {/* Image area */}
      <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
      {/* Brand */}
      <div className="h-2.5 bg-gray-100 rounded w-1/4 mb-2" />
      {/* Name (2 lines) */}
      <div className="h-3.5 bg-gray-100 rounded mb-1.5" />
      <div className="h-3.5 bg-gray-100 rounded w-3/4 mb-3" />
      {/* Platform count */}
      <div className="h-2.5 bg-gray-100 rounded w-1/2 mb-4" />
      {/* Price row */}
      <div className="flex items-end justify-between pt-3 border-t border-gray-50 mt-auto">
        <div>
          <div className="h-2.5 bg-gray-100 rounded w-14 mb-1.5" />
          <div className="h-5 bg-blue-50 rounded w-20" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  );
}
