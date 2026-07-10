import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../../styles/Chart.css';

interface ChartProps {
  title: string;
  data: Array<Record<string, unknown>>;
  dataKey: string;
  dataKey2?: string;
  loading?: boolean;
  color?: string;
  color2?: string;
  yAxisLabel?: string;
}

export const Chart: React.FC<ChartProps> = ({
  title,
  data,
  dataKey,
  dataKey2,
  loading = false,
  color = '#3498db',
  color2 = '#e74c3c',
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
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="timestamp"
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
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={false}
            isAnimationActive={true}
            strokeWidth={2}
          />
          {dataKey2 && (
            <Line
              type="monotone"
              dataKey={dataKey2}
              stroke={color2}
              dot={false}
              isAnimationActive={true}
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
