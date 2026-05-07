#!/bin/bash
# Dashboard Nora - Script de Inicio
# Este script facilita la ejecución del dashboard en Linux/Mac

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Dashboard Nora - Sistema de Medición de IA      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Verificar si npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm no está instalado"
    echo "Por favor instala Node.js desde https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js y npm encontrados"
echo ""

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error al instalar dependencias"
        exit 1
    fi
    echo "✅ Dependencias instaladas"
    echo ""
fi

echo "🚀 Iniciando servidor de desarrollo..."
echo ""
echo "📝 El dashboard estará disponible en:"
echo "   http://localhost:5173"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

npm run dev
