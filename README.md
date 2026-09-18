# Contenido BBPS

Web app para sortear locales del Bahía Blanca Plaza Shopping para **Reels** y **Stories**, con historial, buscador y panel de locales.

## Estructura

```
index.html      pantalla principal + panel de locales
styles.css      estilos
app.js          reglas, sorteo, historial, buscador, panel
api/data.js     función serverless de Vercel (lee/guarda en Upstash Redis)
```

## Edición manual

Después de tirar el dado (o desde los casilleros vacíos) se puede tocar cualquier casillero y elegir otro local de la lista, con buscador por nombre o categoría. El selector marca los locales que ya están elegidos y los que salieron hace poco. También se puede vaciar un casillero.

El OK se habilita cuando están todos los casilleros completos. Si el armado manual rompe alguna regla, aparece un aviso amarillo y, al confirmar, la app pregunta si querés guardarlo igual.

## Reglas implementadas

**Reel (2 locales)**
- Un local que salió en Reel en los últimos 2 meses no participa.
- Siempre al menos 1 local de categoría con la palabra MODA.
- Nunca 2 locales de la misma categoría.
- MODA UNISEX nunca va con MODA MUJER, MODA HOMBRE ni MODA UNISEX.

**Stories (5 locales)**
- Un local que salió en Stories en las últimas 48 horas no participa.
- Siempre al menos 3 locales de MODA; el resto se completa con cualquier local disponible.

Los valores se cambian arriba de todo en `app.js` (objeto `REGLAS`).

## Deploy

1. Subí la carpeta a un repo de GitHub.
2. En Vercel: **Add New → Project** → importá el repo → **Deploy** (no hace falta build).
3. En el proyecto de Vercel: **Storage → Create / Connect Database → Upstash (Redis)** y conectala al proyecto. Vercel crea solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. **Redeploy** para que tome las variables.
5. (Opcional) En **Settings → Environment Variables** agregá `APP_PASSWORD` y redeployá: la app va a pedir esa contraseña.

La primera vez que se abre, carga la lista inicial de 82 locales en la base.

## Modo local

Si abrís `index.html` directo en el navegador (o la base no está conectada), la app funciona igual pero guarda todo solo en ese navegador y muestra el cartel **Modo local**.
