#!/bin/bash

echo "🧹 Limpiando caché de Next.js..."
rm -rf .next

echo ""
echo "✅ Variables de entorno detectadas:"
cat .env

echo ""
echo "🚀 Iniciando servidor de desarrollo..."
echo "   → Espera a ver 'Ready in X ms'"
echo "   → Luego abre: http://localhost:3000"
echo ""
echo "💡 Si ves el error de variables de entorno, significa que"
echo "   el servidor ya estaba corriendo. Deténlo (Ctrl+C) y"
echo "   ejecuta este script de nuevo."
echo ""

npm run dev
