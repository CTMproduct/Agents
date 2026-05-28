import React from 'react';
import { useBackendHealth } from '../hooks/useBackendHealth';
import '../styles/BackendStatus.css';

export const BackendStatus: React.FC = () => {
  const { isHealthy, isChecking, error, retry, lastCheck } = useBackendHealth();

  return (
    <div className={`backend-status ${isHealthy ? 'backend-status--online' : 'backend-status--offline'}`}>
      <div className="backend-status__indicator">
        <span className={`backend-status__dot ${isHealthy ? 'backend-status__dot--online' : 'backend-status__dot--offline'}`} />
        <span className="backend-status__label">
          {isChecking ? 'Verificando...' : isHealthy ? 'Backend Online' : 'Backend Offline'}
        </span>
      </div>
      {error && (
        <div className="backend-status__error">
          <p>{error}</p>
          <button onClick={retry} className="backend-status__retry">
            Reintentar
          </button>
        </div>
      )}
      {lastCheck && (
        <p className="backend-status__timestamp">
          Última verificación: {lastCheck.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};
