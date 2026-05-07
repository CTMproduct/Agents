# Nora Dashboard - Notas de Desarrollo

## Arquitectura

El dashboard utiliza una arquitectura moderna basada en componentes:

1. **Componentes**: Componentes React reutilizables y independientes
2. **Hooks Personalizados**: `useMetrics` para datos principales, `useChartData` para gráficos
3. **Servicio API**: Capa de abstracción para comunicación con la API
4. **Estilos**: CSS modular organizado por componente

## Flujo de Datos

```
API → apiService → useMetrics/useChartData → Dashboard → Componentes
```

## Integración con la API

Si tu API Nora implementa los endpoints, el dashboard se conectará automáticamente.
Si no, el dashboard muestra datos de prueba (mock data).

### Endpoints Requeridos

```typescript
// Métricas principales
GET /api/metrics
Response: {
  conversations: { total, today, averageDuration, averageSatisfaction, trend },
  performance: { uptime, averageLatency, errorRate, requestsPerMinute, peakLatency },
  hallucination: { rate, count, factualAccuracy, byTopic }
}

// Históricos
GET /api/conversations/history?limit=24
GET /api/performance/history?limit=24
GET /api/hallucinations/history?limit=7
```

## Estados del Sistema

El dashboard usa colores para indicar estado:
- 🟢 **Verde (Bueno)**: > 95% uptime, < 1% error, < 1% alucinación
- 🟡 **Amarillo (Advertencia)**: Entre rangos normales
- 🔴 **Rojo (Crítico)**: Debajo de rangos aceptables

## Mejoras Futuras

- [ ] Exportar reporte PDF
- [ ] Historial de alertas
- [ ] Comparación de períodos
- [ ] Análisis predictivo
- [ ] Integración con Slack/Teams
- [ ] Dark mode
- [ ] Personalización de widgets
- [ ] Descarga de datos CSV

## Debugging

Para ver logs de API:
1. Abre DevTools (F12)
2. Ve a la pestaña Console
3. Los logs de `apiService` aparecerán con prefix `Error fetching`

## Build para Producción

```bash
npm run build
```

Genera carpeta `dist/` lista para deployar.
