import type { FC } from 'react';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import '../../styles/Chart.css';

interface PieChartComponentProps {
  title: string;
  data: any[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
  loading?: boolean;
}

export const PieChartComponent: FC<PieChartComponentProps> = ({
  title,
  data,
  dataKey,
  nameKey,
  colors = ['#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6'],
  loading = false,
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
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value, payload }) =>
              `${payload?.[nameKey] ?? name}: ${value}%`
            }
            outerRadius={100}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
