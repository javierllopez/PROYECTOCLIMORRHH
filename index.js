// Página de inicio proyecto para CLIMO S.A. 
// AUTOR: Javier López
// Importar módulos

const express = require('express')
const morgan = require('morgan');
const  json  = require('body-parser');
const path = require('path');
const exphbs = require('express-handlebars');
const session = require("express-session");
const helpers = require('./lib/misHelpers');
const device = require('express-device');
const dotenv = require('dotenv');



const app = express()
app.use(json.json());
app.use(json.urlencoded({ extended: false }));
app.use(morgan('dev'));


if (process.env.PORT) {
   const {database} = require('./clavesHeroku');    
}else {
    const {database} = require('./claves');    
const bcrypt = require('bcrypt');
}


//Configuraciones
const port = process.env.PORT||3000;
app.set('port',process.env.PORT||3000);

app.set('views',path.join(__dirname,"views"));
app.use(express.static('public'));
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

// Inicializar variable de sesión
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 10 * 60 * 1000 } // 10 minutes
}));

dotenv.config();

app.use(device.capture());
app.use((req, res, next) => {
    res.locals.isDesktop = req.device.type === 'desktop';
    res.locals.isMobile = req.device.type === 'phone';
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
app.use("/novedades",require('./routes/novedades'));
app.use("/liquidaciones",require('./routes/crearLiquidacion'));
app.use("/autorizarHoras",require('./routes/autorizarHoras'));
app.use("/novedadesTodas",require('./routes/novedadesTodas'));
app.use("/novedadesPorPersonal",require('./routes/novedadesPorPersonal'));
app.use('/novedadesPorSector', require('./routes/novedadesPorSector'));
// Inicializo servidor
app.listen(port, () => {
  console.log(`Aplicación corriendo en el puerto: ${port}`)
})