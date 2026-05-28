#!/bin/bash
# =====================================================
# NORA DASHBOARD - DEBUGGING SCRIPT
# =====================================================

echo "🔍 Iniciando Debugging Completo del Proyecto Nora..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =====================================================
# 1. VERIFICAR VARIABLES DE ENTORNO
# =====================================================
echo -e "${BLUE}=== 1. VERIFICANDO VARIABLES DE ENTORNO ===${NC}"
echo ""

echo "📁 Frontend (.env.local):"
if [ -f .env.local ]; then
  echo -e "${GREEN}✓ Existe${NC}"
  grep -E 'VITE_API_BASE_URL|VITE_DEBUG' .env.local || echo "⚠️  No se encontraron variables VITE_*"
else
  echo -e "${RED}✗ No existe .env.local${NC}"
fi

echo ""
echo "📁 Backend (.env):"
if [ -f backend/.env ]; then
  echo -e "${GREEN}✓ Existe${NC}"
  grep -E 'PORT|NODE_ENV|OPENAI_MODEL' backend/.env | grep -v "OPENAI_API_KEY"
  if grep -q "sk-proj-" backend/.env; then
    echo -e "${RED}⚠️  API KEY expuesta en .env${NC}"
  fi
else
  echo -e "${RED}✗ No existe backend/.env${NC}"
fi

echo ""

# =====================================================
# 2. VERIFICAR DEPENDENCIAS
# =====================================================
echo -e "${BLUE}=== 2. VERIFICANDO DEPENDENCIAS ===${NC}"
echo ""

echo "📦 Frontend Dependencies:"
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓ node_modules existe${NC}"
else
  echo -e "${RED}✗ Falta instalación: npm install${NC}"
fi

echo ""
echo "📦 Backend Dependencies:"
if [ -d "backend/node_modules" ]; then
  echo -e "${GREEN}✓ node_modules existe${NC}"
else
  echo -e "${RED}✗ Falta instalación: cd backend && npm install${NC}"
fi

echo ""

# =====================================================
# 3. VERIFICAR PUERTO
# =====================================================
echo -e "${BLUE}=== 3. VERIFICANDO PUERTOS ===${NC}"
echo ""

if command -v lsof &> /dev/null; then
  echo "Puerto 3000 (Backend):"
  if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓ Backend está corriendo${NC}"
  else
    echo -e "${YELLOW}⚠️  Backend no está en puerto 3000${NC}"
  fi
  
  echo ""
  echo "Puerto 5173 (Frontend Dev):"
  if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓ Frontend está corriendo${NC}"
  else
    echo -e "${YELLOW}⚠️  Frontend no está en puerto 5173${NC}"
  fi
else
  echo "⚠️  'lsof' no disponible - verificar manualmente con 'netstat' o 'ss'"
fi

echo ""

# =====================================================
# 4. ARCHIVOS CRÍTICOS
# =====================================================
echo -e "${BLUE}=== 4. VERIFICANDO ARCHIVOS CRÍTICOS ===${NC}"
echo ""

FILES=(
  "src/services/api.ts"
  "src/hooks/useMetrics.ts"
  "src/hooks/useBackendHealth.ts"
  "backend/server.js"
  "vite.config.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file ${RED}(NO EXISTE)${NC}"
  fi
done

echo ""

# =====================================================
# 5. TEST DE CONEXIÓN
# =====================================================
echo -e "${BLUE}=== 5. TEST DE CONEXIÓN ===${NC}"
echo ""

echo "Intentando conectar a http://localhost:3000..."
if command -v curl &> /dev/null; then
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
  if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Backend respondiendo (HTTP $RESPONSE)${NC}"
  else
    echo -e "${RED}✗ Backend retornó HTTP $RESPONSE${NC}"
  fi
else
  echo "⚠️  'curl' no disponible - verificar manualmente"
fi

echo ""
echo -e "${BLUE}=== DEBUGGING COMPLETADO ===${NC}"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "  1. Si faltan dependencias: npm install && cd backend && npm install"
echo "  2. Si no existen .env: Copiar .env.example a .env/.env.local"
echo "  3. Configurar OPENAI_API_KEY en backend/.env"
echo "  4. Ejecutar: npm run dev (frontend) y npm run dev (backend)"
echo "  5. Verificar http://localhost:5173 en navegador"
echo ""
