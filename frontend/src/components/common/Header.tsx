import React from 'react';
import { BackendStatus } from '../status/BackendStatus';
import '../../styles/Header.css';

interface HeaderProps {
  agentName?: string;
  lastUpdated?: Date;
  isRealtime?: boolean;
  onToggleRealtime?: (value: boolean) => void;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  agentName = 'Nora',
  lastUpdated,
  isRealtime = true,
  onToggleRealtime,
  onRefresh,
}) => {
  return (
    <>
      <BackendStatus />
      <header className="header">
        <div className="header__content">
          <div className="header__left">
            <h1 className="header__title">
              <span className="header__icon">📊</span> Dashboard - {agentName}
            </h1>
            {lastUpdated && (
              <p className="header__subtitle">
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <div className="header__right">
            <button
              className="header__button header__button--refresh"
              onClick={onRefresh}
              title="Actualizar datos"
            >
              🔄 Actualizar
            </button>

            <label className="header__toggle">
              <input
                type="checkbox"
                checked={isRealtime}
                onChange={(e) => onToggleRealtime?.(e.target.checked)}
              />
              <span className="header__toggle-label">Actualización en tiempo real</span>
            </label>
          </div>
        </div>
      </header>
    </>
  );
};
