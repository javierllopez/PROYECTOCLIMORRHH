# Guía para agentes ProyectoClimoRRHH

## Comunicación
- Respondé siempre en castellano rioplatense con tono profesional y cercano.
- Usá voseo cuando sea natural y evitá anglicismos salvo que el código los requiera.
- Antes de proponer cambios grandes, confirmá supuestos con el usuario.

## Setup rápido
- Instalá dependencias con npm install y levantá la app con npm run start (ejecuta node index.js) según [package.json](package.json#L1-L28).
- Para autorecarga local usá npm run test, que dispara nodemon sobre index.js.
- Configurá un archivo .env con SESSION_SECRET, DB_* y MAIL_* en desarrollo; si falta, se cae en [claves.js](claves.js#L1-L8).

## Arquitectura
- El servidor Express central se configura en [index.js](index.js#L1-L140) con helmet, sesiones MySQL y detección de dispositivo.
- Todas las rutas se montan desde el índice para módulos como novedades, liquidaciones y guardias bajo /routes.
- Assets estáticos y CSS viven en /public y /CSS, servidos via app.use en [index.js](index.js#L33-L52).
- En producción se espera HTTPS detrás de proxy; en dev se puede activar TLS con variables HTTPS_DEV/HTTPS_KEY_PATH/HTTPS_CERT_PATH.

## Datos y SQL
- La conexión MySQL usa mysql2/promise y pool en [conexion.js](conexion.js#L1-L90) con timezone UTC forzado por sesión.
- Si faltan variables en prod la app falla rápido; en dev se lee el fallback local [claves.js](claves.js#L1-L8).
- La carpeta [sql](sql) contiene los esquemas; mantené snake_case y claves primarias id, foráneas tabla_id.
- Guardá nuevas consultas parametrizadas usando pool.query para evitar inyección.

## Autenticación y sesiones
- El login vive en [routes/login.js](routes/login.js#L1-L160) con bcrypt, bloqueo por intentos y flag primerAcceso.
- Sesiones se guardan en MySQL con express-mysql-session; pedí req.session.usuario y nivelUsuario antes de responder.
- Usá el middleware logueado de [Middleware/validarUsuario.js](Middleware/validarUsuario.js#L1-L36) y los arrays de niveles en cada router.
- Para renders devolvé siempre render(req,res,...) de [Middleware/render.js](Middleware/render.js#L1-L60) para respetar mensajes flash y detección de dispositivo.

## Front-end
- Las vistas se construyen con Handlebars sobre la plantilla [views/layouts/layout.hbs](views/layouts/layout.hbs#L1-L160) que decide menús según nivel y pantalla.
- El layout carga Bootstrap 5, Bootstrap Icons, Chart.js y scripts CSP-friendly desde /public/js.
- No agregues inline scripts: apoyate en helpers como [public/js/tabla-csp.js](public/js/tabla-csp.js#L1-L120) y [public/js/nav-mobile-badges.js](public/js/nav-mobile-badges.js#L1-L120).
- Las fechas mostradas deben formatearse a DD/MM/YYYY horario local usando helpers en [lib/misHelpers.js](lib/misHelpers.js#L1-L200).

## Helpers y reutilizables
- La clase Tabla de [Clases/Tabla.js](Clases/Tabla.js#L1-L220) arma listados con filtros, orden y paginación; reutilizala antes de escribir SQL manual.
- Los conversores de fechas y husos están en [lib/libreria.js](lib/libreria.js#L1-L220); almacená en UTC y convertí a AR para mostrar.
- Para correos usá enviarCorreo de [lib/mailer.js](lib/mailer.js#L1-L120) y definí MAIL_HOST/PORT/USER/PASSWORD.
- Nuevos helpers de Handlebars van en misHelpers y deben seguir el patrón exportado actual.

## Integraciones y jobs
- La importación Excel usa multer y un job en memoria en [routes/novedadesImportar.js](routes/novedadesImportar.js#L1-L220); mantené los estados en trabajos Map.
- Archivos subidos se guardan en /uploads; limpiá si agregás procesos de background.
- Los badges móviles consultan endpoints JSON que deben devolver {cantidad}, ver [public/js/nav-mobile-badges.js](public/js/nav-mobile-badges.js#L1-L120).
- Para dashboards, sumas y gráficos se calculan en [routes/index.js](routes/index.js#L1-L320); conservá ese formato si extendés métricas.

## Estilo y convenciones
- Nombrá variables y funciones en español descriptivo; mantené indentación de 2 espacios en JS/Handlebars.
- Evitá duplicar SQL; si una consulta existe en otra ruta, centralizala en una función compartida.
- Documentá funciones no triviales con comentarios breves antes del bloque; evitá comentarios redundantes.
- Los commits deben ser concisos y en español, p.e. "Ajusta importador de novedades".

## Verificaciones y soporte
- No hay suites automáticas; validá flujos críticos manualmente tras cambios (login, carga de novedades, dashboard).
- Revisá logs del servidor (morgan y console) para diagnosticar consultas fallidas.
- Si detectás reglas faltantes (p.ej. validarNivel carece de next), consultá al usuario antes de refactorizar.

