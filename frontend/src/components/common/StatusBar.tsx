import React from 'react';
import '../../styles/StatusBar.css';

interface StatusBarProps {
  label: string;
  value: number; // 0-100
  color?: string;
  unit?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  label,
  value,
  color,
  unit = '%',
}) => {
  const getColor = () => {
    if (color) return color;
    if (value >= 95) return '#27ae60';
    if (value >= 85) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div className="status-bar">
      <div className="status-bar__header">
        <span className="status-bar__label">{label}</span>
        <span className="status-bar__value">
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="status-bar__track">
        <div
          className="status-bar__fill"
          style={{
            width: `${Math.min(value, 100)}%`,
            backgroundColor: getColor(),
          }}
        />
      </div>
    </div>
  );
};
