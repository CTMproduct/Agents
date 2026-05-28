# NORA DASHBOARD - DEBUGGING SCRIPT (PowerShell Windows)

Write-Host "=== NORA DASHBOARD - DEBUGGING COMPLETO ===" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# 1. VERIFICAR VARIABLES DE ENTORNO
# =====================================================
Write-Host "=== 1. VARIABLES DE ENTORNO ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Frontend (.env.local):"
if (Test-Path ".env.local") {
    Write-Host "OK - Existe" -ForegroundColor Green
} else {
    Write-Host "ERROR - No existe" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend (.env):"
if (Test-Path "backend\.env") {
    Write-Host "OK - Existe" -ForegroundColor Green
} else {
    Write-Host "ERROR - No existe" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# 2. VERIFICAR DEPENDENCIAS
# =====================================================
Write-Host "=== 2. DEPENDENCIAS ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Frontend node_modules:"
if (Test-Path "node_modules") {
    Write-Host "OK - Instalado" -ForegroundColor Green
} else {
    Write-Host "ERROR - Falta: npm install" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend node_modules:"
if (Test-Path "backend\node_modules") {
    Write-Host "OK - Instalado" -ForegroundColor Green
} else {
    Write-Host "ERROR - Falta: cd backend; npm install" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# 3. VERIFICAR PUERTOS
# =====================================================
Write-Host "=== 3. PUERTOS ===" -ForegroundColor Blue
Write-Host ""

$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

Write-Host "Puerto 3000 (Backend):"
if ($port3000) {
    Write-Host "OK - Backend esta corriendo" -ForegroundColor Green
} else {
    Write-Host "WARNING - Backend no detectado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Puerto 5173 (Frontend):"
if ($port5173) {
    Write-Host "OK - Frontend esta corriendo" -ForegroundColor Green
} else {
    Write-Host "WARNING - Frontend no detectado" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# 4. ARCHIVOS CRITICOS
# =====================================================
Write-Host "=== 4. ARCHIVOS CRITICOS ===" -ForegroundColor Blue
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
        Write-Host "OK - $file" -ForegroundColor Green
    } else {
        Write-Host "ERROR - $file NO EXISTE" -ForegroundColor Red
    }
}

Write-Host ""

# =====================================================
# 5. TEST DE CONEXION
# =====================================================
Write-Host "=== 5. TEST DE CONEXION ===" -ForegroundColor Blue
Write-Host ""

Write-Host "Conectando a http://localhost:3000..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "OK - Backend respondiendo (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "ERROR - Backend no responde" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== DEBUGGING COMPLETADO ===" -ForegroundColor Blue
Write-Host ""
