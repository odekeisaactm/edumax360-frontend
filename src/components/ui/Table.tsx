import React from 'react';

interface TableColumn<T> {
  key: keyof T;
  title: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  className?: string;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  className?: string;
  rowKey?: keyof T;
  onRowClick?: (record: T, index: number) => void;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = 'No data available',
  className = '',
  rowKey = 'id',
  onRowClick,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="w-full">
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        <div className="min-h-[200px] flex items-center justify-center text-gray-500">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  column.className || ''
                }`}
                style={{ width: column.width }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((record, index) => (
            <tr
              key={String(record[rowKey])}
              onClick={() => onRowClick?.(record, index)}
              className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                    column.className || ''
                  }`}
                >
                  {column.render
                    ? column.render(record[column.key], record, index)
                    : String(record[column.key] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}