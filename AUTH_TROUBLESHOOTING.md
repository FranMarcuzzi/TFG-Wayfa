# Solución de Problemas de Autenticación

Si la autenticación se queda cargando o no funciona correctamente, sigue estos pasos:

## 1. Verificar Configuración de Supabase Auth

**IMPORTANTE**: La confirmación de email debe estar DESHABILITADA para desarrollo.

### Pasos en Supabase Dashboard:

1. Ve a tu proyecto: https://supabase.com/dashboard/project/kckgusvefbatakzfmviy
2. Navega a **Authentication** → **Providers** → **Email**
3. Verifica que:
   - ✅ "Enable Email provider" esté ACTIVADO
   - ❌ "Confirm email" esté DESACTIVADO (muy importante)

### Por qué esto es importante:

Si "Confirm email" está activado, Supabase enviará un email de confirmación y NO permitirá que el usuario inicie sesión hasta que confirme. Esto causa que la app se quede cargando esperando una sesión que nunca llega.

## 2. Verificar Variables de Entorno

Asegúrate de que tu archivo `.env` tenga las credenciales correctas:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://kckgusvefbatakzfmviy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

Puedes encontrar estas credenciales en:
- Supabase Dashboard → Settings → API

## 3. Limpiar Cache y Datos

A veces el navegador almacena datos de sesión corruptos:

1. Abre las DevTools del navegador (F12)
2. Ve a Application → Storage
3. Click en "Clear site data"
4. Recarga la página (Ctrl+Shift+R o Cmd+Shift+R)

## 4. Verificar la Consola del Navegador

Abre las DevTools (F12) y ve a la pestaña Console. Busca errores como:

- ❌ "Missing Supabase environment variables" → Verifica tu .env
- ❌ "Invalid API key" → Verifica que tu ANON_KEY sea correcta
- ❌ "User not confirmed" → Desactiva confirmación de email en Supabase

## 5. Probar el Flujo de Autenticación

### Registro:

```bash
1. Ve a http://localhost:3000/register
2. Ingresa un email (puede ser falso: test@test.com)
3. Ingresa una contraseña (mínimo 6 caracteres)
4. Click "Sign up"
```

**Comportamiento esperado:**
- El botón dice "Creating account..."
- Después de 1-2 segundos, te redirige a /dashboard
- Si se queda cargando → problema de configuración

### Login:

```bash
1. Ve a http://localhost:3000/login
2. Ingresa el email que registraste
3. Ingresa la contraseña
4. Click "Sign in"
```

**Comportamiento esperado:**
- El botón dice "Signing in..."
- Después de 1-2 segundos, te redirige a /dashboard
- Si se queda cargando → problema de configuración

## 6. Verificar en Supabase Dashboard

Después de registrarte, verifica que el usuario se haya creado:

1. Ve a Supabase Dashboard → Authentication → Users
2. Deberías ver tu usuario listado
3. Verifica que el campo "Confirmed at" tenga una fecha (no debe estar vacío)

Si "Confirmed at" está vacío, significa que la confirmación de email está activada y debes desactivarla.

## 7. Errores Comunes

### Error: "Se queda en 'Loading...'"

**Causa**: AuthGuard no puede obtener la sesión.

**Solución**:
1. Verifica que la confirmación de email esté desactivada
2. Limpia el localStorage del navegador
3. Intenta registrarte de nuevo

### Error: "Email not confirmed"

**Causa**: Confirmación de email activada en Supabase.

**Solución**:
1. Ve a Authentication → Providers → Email
2. Desactiva "Confirm email"
3. Elimina el usuario existente en Authentication → Users
4. Regístrate de nuevo

### Error: "Invalid login credentials"

**Causa**: Contraseña incorrecta o usuario no existe.

**Solución**:
1. Verifica que estés usando el email correcto
2. Verifica que la contraseña sea la correcta (mínimo 6 caracteres)
3. Si olvidaste la contraseña, elimina el usuario y regístrate de nuevo

## 8. Verificar que Todo Funcione

Después de seguir estos pasos, prueba el flujo completo:

```bash
# Inicia el servidor
npm run dev

# En el navegador:
1. ✅ Regístrate en /register
2. ✅ Verifica que te redirija a /dashboard
3. ✅ Verifica que veas "Your Trips"
4. ✅ Cierra sesión (botón "Sign out")
5. ✅ Verifica que te redirija a /login
6. ✅ Inicia sesión con tus credenciales
7. ✅ Verifica que te redirija a /dashboard de nuevo
```

Si todos estos pasos funcionan, ¡la autenticación está configurada correctamente!

## 9. Debugging Avanzado

Si los problemas persisten, agrega esto temporalmente a `app/login/page.tsx` después de la línea 23:

```typescript
const { data, error } = await signIn(email, password);
console.log('SignIn result:', { data, error });
```

Esto te mostrará en la consola exactamente qué está retornando Supabase.

## 10. Contacto con Soporte

Si ninguno de estos pasos funciona:

1. Copia el error de la consola del navegador
2. Copia el error de la terminal (si hay alguno)
3. Verifica el estado de Supabase: https://status.supabase.com
4. Busca en la documentación: https://supabase.com/docs/guides/auth

## Configuración Correcta Final

Tu configuración de Supabase Auth debe verse así:

```
Authentication → Providers → Email
├── ✅ Enable Email provider: ON
├── ❌ Confirm email: OFF
├── ✅ Enable sign ups: ON
└── Min password length: 6
```

Con esta configuración, la autenticación debería funcionar sin problemas.
