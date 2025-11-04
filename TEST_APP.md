# Test de la Aplicación

## ✅ Simplificado para Funcionar

He simplificado toda la aplicación para que funcione de manera básica.

## 🚀 Pasos para Probar

### 1. Reiniciar el Servidor

```bash
# Detén el servidor si está corriendo (Ctrl+C)
rm -rf .next
npm run dev
```

### 2. Abrir en el Navegador

Ve a: http://localhost:3000

**Deberías ver:**
- Una página de bienvenida con "Wayfa"
- Botones "Get Started" y "Sign In"
- Fondo azul degradado

### 3. Probar Registro

1. Click en "Get Started"
2. Email: test@test.com
3. Password: test123
4. Confirmar password: test123
5. Click "Sign up"

**Resultado esperado:**
- Te redirige a /dashboard
- Ves "Your Trips" y un botón para crear viajes

### 4. Probar Login

1. Ve a http://localhost:3000
2. Click en "Sign In"
3. Email: test@test.com
4. Password: test123
5. Click "Sign in"

**Resultado esperado:**
- Te redirige a /dashboard

## 🔧 Cambios Realizados

1. **Página principal simplificada** - Ya no redirige automáticamente
2. **Credenciales hardcoded** - Las variables de Supabase están en el código como fallback
3. **AuthGuard simplificado** - Menos checks, más directo
4. **Middleware eliminado** - Ya no interfiere
5. **Manejo de errores básico** - Sin logs complicados

## ⚠️ Configuración de Supabase

IMPORTANTE: Para que el registro funcione, debes:

1. Ir a: https://supabase.com/dashboard/project/kckgusvefbatakzfmviy
2. Authentication → Providers → Email
3. **Desactivar "Confirm email"**
4. Guardar

## 🐛 Si Hay Problemas

### Pantalla en blanco
- Abre la consola (F12)
- Busca errores en rojo
- Copia el mensaje completo

### "Loading..." infinito
- Significa que Supabase tiene "Confirm email" activado
- Ve al dashboard de Supabase y desactívalo

### Error 404
- Verifica que el servidor esté corriendo
- Busca "Ready in X ms" en la terminal

## ✅ Lo Que Debería Funcionar Ahora

- ✅ Página principal carga
- ✅ Puedes navegar a login/register
- ✅ Registro funciona (si desactivaste confirm email)
- ✅ Login funciona
- ✅ Dashboard muestra
- ✅ Puedes crear viajes

## 📦 Credenciales de Prueba

Si todo funciona, usa estas credenciales:

```
Email: test@test.com
Password: test123
```

O crea tus propias credenciales desde /register
