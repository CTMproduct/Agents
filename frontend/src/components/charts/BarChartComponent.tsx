import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../../styles/Chart.css';

interface BarChartComponentProps {
  title: string;
  data: any[];
  dataKey: string;
  loading?: boolean;
  color?: string;
  yAxisLabel?: string;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  title,
  data,
  dataKey,
  loading = false,
  color = '#3498db',
  yAxisLabel,
}) => {
  if (loading) {
    return (
      <div className="chart chart--loading">
        <h3 className="chart__title">{title}</h3>
        <div className="chart__skeleton">Cargando...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="chart chart--empty">
        <h3 className="chart__title">{title}</h3>
        <div className="chart__empty-state">No hay datos disponibles</div>
      </div>
    );
  }

  return (
    <div className="chart">
      <h3 className="chart__title">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#95a5a6"
          />
          <YAxis
            label={{ value: yAxisLabel || '', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
            stroke="#95a5a6"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <Legend />
          <Bar dataKey={dataKey} fill={color} isAnimationActive={true} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
