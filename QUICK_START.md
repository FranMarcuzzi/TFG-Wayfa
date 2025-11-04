# Quick Start - Wayfa

## 🚀 Inicio Rápido (3 minutos)

### 1. Reiniciar el Servidor

```bash
# Detén el servidor si está corriendo (Ctrl+C)
rm -rf .next
npm run dev
```

O usa el script:
```bash
./start-fresh.sh
```

### 2. Configurar Supabase

Ve a: https://supabase.com/dashboard/project/kckgusvefbatakzfmviy/auth/providers

```
Authentication → Providers → Email
  ✅ Enable Email provider = ON
  ❌ Confirm email = OFF  ← ¡IMPORTANTE!
  ✅ Enable sign ups = ON
```

### 3. Probar la App

1. Abre: http://localhost:3000
2. Click "Sign up"
3. Email: test@test.com
4. Password: test123
5. Deberías ver el dashboard

## 🐛 Problemas Comunes

### Error: "Missing Supabase environment variables"
**Solución:** Reinicia el servidor (ver paso 1)

### Se queda en "Loading..."
**Solución:** Desactiva "Confirm email" en Supabase (ver paso 2)

### No se actualizan los cambios en tiempo real
**Solución:** Habilita Realtime en Supabase
- Ve a: Database → Replication
- Activa: activities, messages, polls, poll_options, poll_votes

## 📚 Documentación Completa

- `README.md` - Visión general completa
- `GETTING_STARTED.md` - Guía detallada de inicio
- `AUTH_TROUBLESHOOTING.md` - Solución de problemas de autenticación
- `REALTIME_SETUP.md` - Configuración de Realtime
- `DEPLOYMENT.md` - Deploy a Netlify
- `ARCHITECTURE.md` - Documentación técnica

## ✅ Checklist de Verificación

- [ ] Servidor iniciado sin errores
- [ ] Página principal carga correctamente
- [ ] Puedo registrar un usuario
- [ ] Puedo iniciar sesión
- [ ] Puedo crear un viaje
- [ ] Puedo agregar días y actividades
- [ ] El chat funciona
- [ ] Las encuestas funcionan

## 🆘 Necesitas Ayuda?

1. Revisa la consola del navegador (F12)
2. Lee `AUTH_TROUBLESHOOTING.md`
3. Verifica que el .env tenga las variables correctas: `cat .env`
4. Verifica el estado de Supabase: https://status.supabase.com

## 🎯 Variables de Entorno

Tu archivo `.env` debe tener:
```
NEXT_PUBLIC_SUPABASE_URL=https://kckgusvefbatakzfmviy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_aqui
```

**IMPORTANTE:** Reinicia el servidor después de cambiar el .env
