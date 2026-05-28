# =====================================================
# NORA DASHBOARD - DEBUGGING SCRIPT (PowerShell)
# =====================================================

Write-Host "🔍 Iniciando Debugging Completo del Proyecto Nora..." -ForegroundColor Cyan
Write-Host ""

# =====================================================
# 1. VERIFICAR VARIABLES DE ENTORNO
# =====================================================
Write-Host "=== 1. VERIFICANDO VARIABLES DE ENTORNO ===" -ForegroundColor Blue
Write-Host ""

Write-Host "📁 Frontend (.env.local):"
if (Test-Path ".env.local") {
    Write-Host "✓ Existe" -ForegroundColor Green
    $envContent = Get-Content ".env.local"
    $envContent | Select-String -Pattern "VITE_API_BASE_URL|VITE_DEBUG"
} else {
    Write-Host "✗ No existe .env.local" -ForegroundColor Red
}

Write-Host ""
Write-Host "📁 Backend (.env):"
if (Test-Path "backend\.env") {
    Write-Host "✓ Existe" -ForegroundColor Green
    Get-Content "backend\.env" | Select-String -Pattern "PORT|NODE_ENV|OPENAI_MODEL"
    if ((Get-Content "backend\.env") -match "sk-proj-") {
        Write-Host "⚠️  API KEY expuesta en .env" -ForegroundColor Red
    }
} else {
    Write-Host "✗ No existe backend\.env" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# 2. VERIFICAR DEPENDENCIAS
# =====================================================
Write-Host "=== 2. VERIFICANDO DEPENDENCIAS ===" -ForegroundColor Blue
Write-Host ""

Write-Host "📦 Frontend Dependencies:"
if (Test-Path "node_modules") {
    Write-Host "✓ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "✗ Falta instalación: npm install" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend Dependencies:"
if (Test-Path "backend\node_modules") {
    Write-Host "OK - node_modules exists" -ForegroundColor Green
} else {
    Write-Host "MISSING - Run: cd backend; npm install" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# 3. VERIFICAR PUERTO
# =====================================================
Write-Host "=== 3. VERIFICANDO PUERTOS ===" -ForegroundColor Blue
Write-Host ""

$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

Write-Host "Puerto 3000 (Backend):"
if ($port3000) {
    Write-Host "✓ Backend está corriendo" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend no está en puerto 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Puerto 5173 (Frontend Dev):"
if ($port5173) {
    Write-Host "✓ Frontend está corriendo" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend no está en puerto 5173" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# 4. ARCHIVOS CRÍTICOS
# =====================================================
Write-Host "=== 4. VERIFICANDO ARCHIVOS CRÍTICOS ===" -ForegroundColor Blue
Write-Host ""

$files = @(
    "src\services\api.ts",
    "src\hooks\useMetrics.ts",
    "src\hooks\useBackendHealth.ts",
    "src\components\BackendStatus.tsx",
    "backend\server.js",
    "vite.config.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file (NO EXISTE)" -ForegroundColor Red
    }
}

Write-Host ""

# =====================================================
# 5. TEST DE CONEXIÓN
# =====================================================
Write-Host "=== 5. TEST DE CONEXIÓN ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Intentando conectar a http://localhost:3000..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Backend respondiendo (HTTP $($response.StatusCode))" -ForegroundColor Green
    Write-Host "Respuesta: $($response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 1)"
} catch {
    Write-Host "✗ Backend no responde: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== DEBUGGING COMPLETADO ===" -ForegroundColor Blue
Write-Host ""
Write-Host "📝 PRÓXIMOS PASOS:"
Write-Host "  1. Si faltan dependencias: npm install && cd backend && npm install"
Write-Host "  2. Si no existen .env: Copiar .env.example a .env/.env.local"
Write-Host "  3. Configurar OPENAI_API_KEY en backend\.env"
Write-Host "  4. Ejecutar: npm run dev (frontend) y npm run dev (backend)"
Write-Host "  5. Verificar http://localhost:5173 en navegador"
Write-Host ""
