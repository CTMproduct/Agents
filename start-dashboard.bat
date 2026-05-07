@echo off
REM Dashboard Nora - Script de Inicio
REM Este script facilita la ejecución del dashboard en Windows

cls
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║     Dashboard Nora - Sistema de Medición de IA      ║
echo ╚══════════════════════════════════════════════════════╝
echo.

REM Verificar si npm está instalado
where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ Error: npm no está instalado o no está en el PATH
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js y npm encontrados
echo.

REM Verificar si node_modules existe
if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo ❌ Error al instalar dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
    echo.
)

echo 🚀 Iniciando servidor de desarrollo...
echo.
echo 📝 El dashboard estará disponible en:
echo    http://localhost:5173
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

call npm run dev
pause
