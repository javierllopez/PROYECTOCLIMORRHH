// Página de inicio proyecto para CLIMO S.A. 
// AUTOR: Javier López
// Importar módulos

const express = require('express')
const http = require('http');
const https = require('https');
const fsSync = require('fs');
const morgan = require('morgan');
const  json  = require('body-parser');
const path = require('path');
const exphbs = require('express-handlebars');
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const { pool } = require('./conexion');
const helpers = require('./lib/misHelpers');
const device = require('express-device');
const dotenv = require('dotenv');
const helmet = require('helmet');

const esProduccion = process.env.NODE_ENV === 'production' || Boolean(process.env.PORT);
let esHttpsDev;
if (!esProduccion) {
    // En desarrollo cargamos variables desde .env
    dotenv.config();
    esHttpsDev = String(process.env.HTTPS_DEV).toLowerCase() === 'true';

} else {
    console.log('Entorno producción detectado: se usan variables de entorno de Heroku para la base de datos');
}

const app = express()
app.use(json.json());
app.use(json.urlencoded({ extended: false }));
app.use(morgan('dev'));

// Seguridad HTTP headers
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
    fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'self'"],
    scriptSrcAttr: ["'none'"]
};

app.use(helmet({
    contentSecurityPolicy: {
        directives: cspDirectives,
    },
    crossOriginEmbedderPolicy: false,
}));

//Configuraciones
const port = process.env.PORT||3000;
app.set('port',process.env.PORT||3000);

app.set('views',path.join(__dirname,"views"));
// Servir assets estáticos
app.use('/CSS', express.static(path.join(__dirname, 'CSS')));
app.use(express.static('public'));

// Respuestas rápidas para bots: favicon y robots
// Evita 404 ruidosos en logs sin afectar la app
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get(['/robots.txt', '/login/robots.txt'], (_req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /');
});
// Sitemap bajo /login consultado por bots
app.get('/login/sitemap.xml', (_req, res) => res.status(204).end());
// Registrar partial
app.engine('.hbs', exphbs.engine({
    defaultLayout: "layout",
    layoutDir: path.join(app.get("views"), "layouts"),
    partialsDir: path.join(app.get('views'), "partials"),
    cache: false,
    helpers: helpers,
    extname: ".hbs"
}));
app.set('view engine','.hbs');

// Inicializar variable de sesión usando clave segura desde .env
if (esProduccion) {
    // Necesario en plataformas detrás de proxy (Heroku) para que "secure cookies" funcionen
    app.set('trust proxy', 1);
}

const opcionesCookieSesion = {
    maxAge: 10 * 60 * 1000, // 10 minutos
    httpOnly: true,
    sameSite: 'lax',
    secure: esProduccion || esHttpsDev, // sobre HTTPS en producción y en dev si se habilita HTTPS_DEV
};

// Store de sesiones en MySQL para producción y desarrollo
// Usa el pool centralizado desde ./conexion (timezone UTC, pooling, etc.)
const opcionesStore = {
    // Si la tabla no existe, la crea automáticamente
    createDatabaseTable: true,
    // Mantener nombres por defecto para compatibilidad rápida
    // Si se desea, se puede personalizar el esquema a snake_case en otra iteración
};
const sessionStore = new MySQLStore(opcionesStore, pool);

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-change-this-secret',
    resave: false,
    saveUninitialized: false, // evita filas vacías en la tabla de sesiones
    store: sessionStore,
    cookie: opcionesCookieSesion,
}));

app.use(device.capture());
app.use((req, res, next) => {
    res.locals.isDesktop = req.device.type === 'desktop';
    res.locals.isMobile = req.device.type === 'phone';
    // Título dinámico según entorno
    res.locals.tituloAplicacion = 'CLIMO S.A.' + (esProduccion ? '' : ' - entorno de desarrollo');
    next();
});


//Routes

app.use("/",require('./routes'));
app.use("/login",require('./routes/login'));
app.use("/sectores",require('./routes/sectores'));
app.use("/categorias",require('./routes/categorias'));
app.use("/turnos",require('./routes/turnos'));
app.use("/motivos",require('./routes/motivos'));
app.use("/guardias",require('./routes/guardias'));
app.use("/nomina",require('./routes/nomina'));
app.use("/itemsNomina",require('./routes/itemsNomina'));
app.use("/nominaValorizada",require('./routes/nominaValorizada'));
app.use("/personal",require('./routes/personal'));
app.use("/salir",require('./routes/salir'));
app.use('/novedades/importar', require('./routes/novedadesImportar'));
app.use("/novedades",require('./routes/novedades'));
app.use("/liquidaciones",require('./routes/crearLiquidacion'));
app.use("/autorizarHoras",require('./routes/autorizarHoras'));
app.use("/novedadesTodas",require('./routes/novedadesTodas'));
app.use("/novedadesPorPersonal",require('./routes/novedadesPorPersonal'));
app.use('/novedadesPorSector', require('./routes/novedadesPorSector'));
app.use('/blanquearClave', require('./routes/blanquearClave'));
app.use('/password', require('./routes/password'));
app.use('/liquidacionesProcesar', require('./routes/liquidacionesProcesar'));
app.use('/ajustesLiquidacion', require('./routes/ajustesLiquidacion'));
app.use('/cierreLiquidacion', require('./routes/cierreLiquidacion'));
app.use('/liquidacionesPorPeriodo', require('./routes/liquidacionesPorPeriodo'));
app.use('/misPagos', require('./routes/misPagos'));
// Inicializo servidor (HTTP por defecto; HTTPS opcional en desarrollo)

if (esHttpsDev) {
    // Carga de certificados desde variables o rutas por defecto
    const keyPath = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'dev.key');
    const certPath = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'dev.crt');
    try {
        const key = fsSync.readFileSync(keyPath);
        const cert = fsSync.readFileSync(certPath);
         https.createServer({ key, cert }, app).listen(port, () => {
            console.log(`Aplicación corriendo en HTTPS (dev) en https://localhost:${port}`);
        });
    } catch (e) {
        console.warn('No se pudo iniciar HTTPS en dev. Asegurate de generar certs dev y setear variables HTTPS_DEV/HTTPS_KEY_PATH/HTTPS_CERT_PATH. Se inicia HTTP. Motivo:', e.message);
        http.createServer(app).listen(port, () => {
            console.log(`Aplicación corriendo en HTTP en http://localhost:${port}`);
        });
    }
} else {
    http.createServer(app).listen(port, () => {
        console.log(`Aplicación corriendo en HTTP${esProduccion ? '' : ' (dev)'} en http://localhost:${port}`)
    });
}