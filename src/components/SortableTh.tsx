import { ArrowDown, ArrowDownUp, ArrowUp } from 'lucide-react';

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  activeKey: K;
  direction: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
  className?: string;
  onSort: (key: K) => void;
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  align = 'left',
  className = '',
  onSort,
}: SortableThProps<K>) {
  const isActive = activeKey === sortKey;
  const justifyClass =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
      ? 'justify-center'
      : 'justify-start';
  const textAlignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={`py-2.5 px-3 ${textAlignClass} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`w-full inline-flex items-center gap-1 whitespace-nowrap transition-colors ${justifyClass} ${
          isActive
            ? 'text-blue-800 font-semibold'
            : 'text-slate-600 hover:text-slate-900 font-semibold'
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3 h-3 shrink-0 text-blue-700" />
          ) : (
            <ArrowDown className="w-3 h-3 shrink-0 text-blue-700" />
          )
        ) : (
          <ArrowDownUp className="w-3 h-3 shrink-0 text-slate-400" />
        )}
      </button>
    </th>
  );
}
