import React from 'react';
import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: LucideIcon;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
  };

  const bgColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
    red: 'bg-red-100',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${bgColorClasses[color]}`}>
          <Icon className={`h-6 w-6 ${colorClasses[color]}`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center">
        {changeType === 'increase' ? (
          <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
        )}
        <p className={`text-sm ${
          changeType === 'increase' ? 'text-green-600' : 'text-red-600'
        }`}>
          {change} from last month
        </p>
      </div>
    </div>
  );
};