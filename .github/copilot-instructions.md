# Copilot Instructions for ProyectoClimoRRHH

## Idioma y Comunicación
- Todas las interacciones, mensajes y respuestas del asistente deben realizarse en español de Argentina (castellano rioplatense).
- Preferí terminología local y ejemplos en contexto argentino. Evitá anglicismos innecesarios.
- Mantené un tono profesional y cercano. Podés usar voseo cuando sea natural en la comunicación con el usuario.

## Estilo de Código
- Usa nombres de variables y funciones descriptivos y en español.
- Mantén la indentación consistente (2 espacios para JavaScript/Handlebars).
- Sigue la guía de estilo oficial de JavaScript y Handlebars.
- Incluye comentarios claros cuando el código no sea autoexplicativo.

## Estructura de base de datos
- Utiliza el sistema de gestión de bases de datos MySql.
- Las tablas deben tener nombres en plural y en español.
- Usa convenciones de nombres en minúsculas y separadas por guiones bajos (snake_case).     
- Las claves primarias deben ser `id` y las claves foráneas deben seguir el formato `tabla_id`.
- Las relaciones entre tablas deben estar claramente definidas y documentadas.
- La estructura de la base de datos utilizada se encuentra en la carpeta `/sql` del proyecto.
- Asegúrate de que las fechas y horas se manejen en formato UTC para evitar problemas de zona horaria.

## Estructura de Archivos
- Coloca los archivos en las carpetas correspondientes según su funcionalidad (por ejemplo, `/routes`, `/models`, `/views`, `/public`).
- Los archivos de configuración deben estar en la raíz del proyecto.
- Usa nombres de archivos descriptivos y en español.

## Buenas Prácticas
- Escribe funciones pequeñas y reutilizables.
- Añade pruebas unitarias para cada función nueva si es posible.
- Documenta las funciones públicas con comentarios JSDoc.
- Evita duplicar código.

## Vistas y Estilo Visual
- Todas las vistas deben diseñarse usando Bootstrap como framework principal de estilos.
- Usa una plantilla base para mantener la coherencia visual (navbar, footer, contenedor principal).
- Utiliza las clases y componentes de Bootstrap para la maquetación, formularios, botones, tablas y alertas.
- Si es necesario personalizar estilos, hazlo en `/CSS/Estilos.css` y mantén los cambios mínimos para preservar la coherencia visual.
- Asegúrate de que las vistas sean responsivas y se vean bien en dispositivos móviles y de escritorio.
- Utiliza Handlebars para la generación dinámica de contenido en las vistas.
- Las fechas y horas leidas de la base de datos deben mostrarese en formato `DD/MM/YYYY` para una mejor legibilidad y en horario local

## Commits
- Los mensajes de commit deben ser breves y descriptivos.
- Usa el idioma español para los mensajes de commit.

## Seguridad
- No incluyas credenciales ni información sensible en el código.
- Usa variables de entorno para datos confidenciales.

## Otros
- Si tienes dudas, consulta la documentación oficial del lenguaje o framework.
- Sigue las recomendaciones de linting y formateo automático.

---
