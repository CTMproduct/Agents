import React from 'react';
import '../styles/MetricCard.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number; // positive or negative percentage
  icon?: string;
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  status = 'good',
  description,
}) => {
  const trendColor = trend !== undefined && trend < 0 ? '#e74c3c' : '#27ae60';
  const statusClass = `metric-card metric-card--${status}`;

  return (
    <div className={statusClass}>
      <div className="metric-card__header">
        <h3 className="metric-card__title">{title}</h3>
        {icon && <span className="metric-card__icon">{icon}</span>}
      </div>

      <div className="metric-card__content">
        <div className="metric-card__value">
          {value}
          {unit && <span className="metric-card__unit">{unit}</span>}
        </div>
        {trend !== undefined && (
          <div className="metric-card__trend" style={{ color: trendColor }}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      {description && <p className="metric-card__description">{description}</p>}
    </div>
  );
};
