const { pool } = require('../conexion.js');

class Relacion {
    // Relacion entre dos tablas
    // tipo: 1 = INNER JOIN, 2 = LEFT JOIN, 3 = RIGHT JOIN

    constructor(tipo, tabla1, campo1, tabla2, campo2) {
        this.tipo = tipo;
        this.tabla1 = tabla1;
        this.campo1 = campo1;
        this.tabla2 = tabla2;
        this.campo2 = campo2;
    }
}
//Clase Tabla
//nombre: nombre de la tabla
//campos: campos de la tabla
//titulos: titulos para mostrar en el encabezado
//tipoDatos: tipo de datos de los campos: [numero, texto, fecha, hora, fechaHora, booleano]
//orden: orden de los campos en la tabla [ASC, DESC, ""]
//filtro: filtro para los campos
//tabla: tabla a la que pertenece el campo
//relaciones: relaciones con otras tablas
//editable: si se pueden editar los campos
//borrable: si se pueden borrar los campos
//agregarRelacion: agrega una relacion con otra tabla
//agregarCampo: agrega un campo a la tabla
//exportarEstructura: exporta la estructura de la tabla
//importarEstructura: importa la estructura de la tabla
//cambiarOrden: cambia el orden de un campo
//cambiarFiltro: cambia el filtro de un campo
//getSQL: devuelve la consulta SQL para la tabla
//getEncabezado: devuelve el encabezado HTML para mostrar la tabla en una pagina web

class Tabla {
    constructor(nombre, editable = true, borrable = true, rutaConsulta = "") {
        this.nombre = nombre;
        this.campos = [];
        this.alias = [];
        this.ancho = [];
        this.titulos = [];
        this.tipoDatos = [];
        this.orden = [];
        this.filtro = [];       //Filtro para cabeceras de tabla
        this.tabla = [];
        this.visible = [];
        this.visible_sm = [];
        this.visible_lg = [];
        this.relaciones = [];
        this.editable = editable;
        this.borrable = borrable;
        this.registrosPorPagina = 5;
        this.paginaActual = 1;
        if (rutaConsulta == "") { this.rutaConsulta = nombre } else { this.rutaConsulta = rutaConsulta };
        this.filtroGeneral = ""; //Filtro general para la tabla
        this.tag = ""   //Valor de uso general
    }
    agregarRelacion(tipo, tabla1, campo1, tabla2, campo2) {
        this.relaciones.push(new Relacion(tipo, tabla1, campo1, tabla2, campo2));
    }
    agregarCampo(args) {
        const { campo, titulo = campo, alias = campo, tipoDato = "texto", orden = "", filtro = "", tabla = this.nombre, ancho = "10%", visible = true, visible_sm = true, visible_lg = true } = args;
        this.campos.push(campo);
        this.alias.push(alias);
        this.titulos.push(titulo);
        this.tipoDatos.push(tipoDato);
        this.orden.push(orden);
        this.filtro.push(filtro);
        this.tabla.push(tabla);
        this.ancho.push(ancho);
        this.visible.push(visible);
        this.visible_sm.push(visible_sm);
        this.visible_lg.push(visible_lg);
    }
    exportarEstructura() {
        var exportar = {};
        exportar.campos = this.campos;
        exportar.alias = this.alias;
        exportar.titulos = this.titulos;
        exportar.tipoDatos = this.tipoDatos;
        exportar.orden = this.orden;
        exportar.filtro = this.filtro;
        exportar.filtros = this.filtros;
        exportar.tabla = this.tabla;
        exportar.relaciones = this.relaciones;
        exportar.ancho = this.ancho;
        exportar.registrosPorPagina = this.registrosPorPagina;
        exportar.paginaActual = this.paginaActual;
        exportar.visible = this.visible;
        exportar.visible_sm = this.visible_sm;
        exportar.visible_lg = this.visible_lg;
        exportar.rutaConsulta = this.rutaConsulta;
        exportar.filtroGeneral = this.filtroGeneral;
        exportar.tag = this.tag;
        return exportar;
    }
    importarEstructura(estructura) {
        this.campos = estructura.campos;
        this.alias = estructura.alias;
        this.titulos = estructura.titulos;
        this.tipoDatos = estructura.tipoDatos;
        this.orden = estructura.orden;
        this.filtro = estructura.filtro;
        this.filtros = estructura.filtros;
        this.tabla = estructura.tabla;
        this.relaciones = estructura.relaciones;
        this.ancho = estructura.ancho;
        this.registrosPorPagina = estructura.registrosPorPagina;
        this.paginaActual = estructura.paginaActual;
        this.visible = estructura.visible;
        this.visible_sm = estructura.visible_sm;
        this.visible_lg = estructura.visible_lg;
        this.rutaConsulta = estructura.rutaConsulta;
        this.filtroGeneral = estructura.filtroGeneral;
        this.tag = estructura.tag;
    }
    cambiarOrden(campo) {
        const ordenActual = this.orden[campo];
        this.orden.fill('');
        if (ordenActual == "ASC") {
            this.orden[campo] = "DESC";
        } else {
            this.orden[campo] = "ASC";
        }
    }
    cambiarFiltro(i, filtro) {
        if (!isNaN(parseInt(i))) {
            this.filtro[i] = filtro;
        } else {
            for (let x = 0; x < this.campos.length; x++) {
                if (this.campos[i] == x) {
                    this.filtro[x] = filtro;
                }
            }
        }
    }
    agregarFiltros(args) {
        const { campo, comparacion, valor1, valor2 } = args;
        this.filtros.push({ campo: campo, comparacion: comparacion, valor1: valor1, valor2: valor2 });
    }
    //Aplica filtro a la tabla
    aplicarFiltroGeneral(filtro) {
        this.filtroGeneral = filtro;
    }
    //Cargo el total de registros de esta tabla
    async getTotalRegistros() {
        var resultado = 0;
        var primeraVez = true;
        var sql = "SELECT COUNT(*) AS Total FROM " + this.nombre;

        "(".repeat(this.relaciones.length);
        for (let i = 0; i < this.relaciones.length; i++) {
            let tipo = "";
            switch (this.relaciones[i].tipo) {
                case 1:
                    tipo = " INNER JOIN ";
                    break;
                case 2:
                    tipo = " LEFT JOIN ";
                    break;
                case 3:
                    tipo = " RIGHT JOIN ";
                    break;
            }
            sql += tipo + this.relaciones[i].tabla2 + " ON " + this.relaciones[i].tabla1 + "." + this.relaciones[i].campo1 + " = " + this.relaciones[i].tabla2 + "." + this.relaciones[i].campo2;
        }
        ")".repeat(this.relaciones.length);
        //Aplico el filtro general si existe
        if (this.filtroGeneral != "") {
            if (primeraVez) {

                sql += " WHERE " + this.filtroGeneral;
                primeraVez = false;
            }
        }
        for (let i = 0; i < this.campos.length; i++) {
            if (this.filtro[i] != "") {
                if (primeraVez) {
                    sql += " WHERE ";
                    primeraVez = false;
                } else {
                    sql += " AND ";
                }
                sql += this.tabla[i] + "." + this.campos[i] + " LIKE '%" + this.filtro[i] + "%'";
            }
        }

        try {
            const [total] = await pool.query(sql);
            resultado = total[0].Total;
        }
        catch (err) {
            console.log(err);
        }
        return resultado;
    }
    getSQL(campo1 = "", valor1 = "", campo2 = "", valor2 = "") {
        let primeraVez = true;
        let sql = "SELECT ";
        for (let i = 0; i < this.campos.length; i++) {
            sql += this.tabla[i] + '.' + this.campos[i];
            if (this.alias[i] != this.campos[i]) {
                sql += " AS " + this.alias[i];
            }
            if (i < this.campos.length - 1) {
                sql += ", ";
            }
        }
        sql += " FROM " + this.nombre;
        "(".repeat(this.relaciones.length);
        for (let i = 0; i < this.relaciones.length; i++) {
            let tipo = "";
            switch (this.relaciones[i].tipo) {
                case 1:
                    tipo = " INNER JOIN ";
                    break;
                case 2:
                    tipo = " LEFT JOIN ";
                    break;
                case 3:
                    tipo = " RIGHT JOIN ";
                    break;
            }
            sql += tipo + this.relaciones[i].tabla2 + " ON " + this.relaciones[i].tabla1 + "." + this.relaciones[i].campo1 + " = " + this.relaciones[i].tabla2 + "." + this.relaciones[i].campo2;
        }
        ")".repeat(this.relaciones.length);
        //Agrego filtros. Si la funcion tiene una variable campo1, valor1, campo2, valor2, se agregan a la consulta
        primeraVez = true;
        if (this.filtroGeneral != "") {
            if (primeraVez) {

                sql += " WHERE " + this.filtroGeneral;
                primeraVez = false;
            }
        }
        if (campo1 != "") {
            if (primeraVez) {
                sql += " WHERE " + campo1 + " = '" + valor1 + "'";
                primeraVez = false;
            }
            if (campo2 != "") {
                sql += " AND " + campo2 + " = '" + valor2 + "'";
            }
        }
        for (let i = 0; i < this.campos.length; i++) {
            if (this.filtro[i] != "") {
                if (primeraVez) {
                    sql += " WHERE ";
                    primeraVez = false;
                } else {
                    sql += " AND ";
                }
                sql += this.tabla[i] + "." + this.campos[i] + " LIKE '%" + this.filtro[i] + "%'";
            }
        }

        if (this.orden.includes("ASC") || this.orden.includes("DESC")) {
            primeraVez = true;
            sql += " ORDER BY ";
            for (let i = 0; i < this.campos.length; i++) {
                if (this.orden[i] != "") {
                    if (primeraVez) {
                        primeraVez = false;
                    } else {
                        sql += ", ";
                    }
                    sql += this.tabla[i] + "." + this.campos[i] + " " + this.orden[i];
                }
            }
        }

        sql += " LIMIT " + this.registrosPorPagina + " OFFSET " + (this.paginaActual - 1) * this.registrosPorPagina;

        return sql;
    }
    getEncabezado() {
        let encabezado = "<tr class='g-1'>";
        for (let i = 0; i < this.titulos.length; i++) {
            if (this.visible[i]) {
                encabezado += "<th class='border bg-light align-middle " + (this.visible_sm[i] == false ? "d-none d-lg-table-cell'" : "'") + " style='width: " + this.ancho[i] + "'>";
                encabezado += "<div class='row g-0 justify-content-between'>";
                encabezado += "<div class='col-md-auto mx-0'>";
                encabezado += this.titulos[i];
                encabezado += "</div>";
                encabezado += "<div class='col-md-auto mx-0'>";
                encabezado += "<a class='link-dark link-underline-opacity-0' href='javascript:ordenar" + this.nombre + "(" + i + ")'>";
                if (this.orden[i] == "ASC") {
                    encabezado += "<i class='bi-chevron-up'></i>";
                } else {
                    if (this.orden[i] == "DESC") {
                        encabezado += "<i class='bi-chevron-down'></i>";
                    } else {
                        encabezado += "<i class='bi-chevron-bar-expand'></i>";
                    }
                }
                encabezado += "</a>";
                if (this.filtro[i] != "") {
                    encabezado += "<a class='link-dark link-underline-opacity-0' href='javascript:filtrar" + this.nombre + "(" + i + "," + '""' + ")'data-bs-toggle='dropdown'>";
                    encabezado += "<i class='bi-funnel-fill'></i>";
                    encabezado += "</a>";
                } else {
                    encabezado += "<a class='link-dark link-underline-opacity-0' href='javascript:filtrar" + this.nombre + "(" + i + "," + '""' + ")'data-bs-toggle='dropdown'>";
                    encabezado += "<i class='bi-funnel'></i>";
                    encabezado += "</a>";
                }
                encabezado += "<div class='dropdown'>";
                encabezado += "<form class='dropdown-menu p-3'>";
                encabezado += "<div class='d-grid gap-2'>";
                encabezado += "<label for='id" + this.titulos[i] + "'>filtro por " + this.titulos[i] + "</label>";
                encabezado += "<input type='text' placeholder='Buscar' id='id" + this.titulos[i] + "' ,"; encabezado += "name='id" + this.titulos[i] + "'></input>";
                encabezado += "<button class='btn btn-primary btn-sm' type='button' onclick='javascript:filtrar" + this.nombre + "(" + i + ", " + '"' + "id";
                encabezado += this.titulos[i] + '")' + "'>Filtrar</button>";
                encabezado += "</div>";
                encabezado += "</form>";
                encabezado += "</div>";
                encabezado += "</div>";
                encabezado += "</div>";
                encabezado += "</th>";
            }
        }

        if (this.editable || this.borrable) {
            encabezado += "<th class='border bg-light text-center'>Acciones</th>";
        }
        encabezado += "</tr>";
        return encabezado;
    }

    async getPaginador() {
        let totalRegistros = await this.getTotalRegistros();
        let totalPaginas = Math.ceil(totalRegistros / this.registrosPorPagina);
        let paginador = "";
        const paginasPorSegmento = 5;
        let segmentoActual = Math.floor((this.paginaActual - 1) / paginasPorSegmento);
        let inicioSegmento = segmentoActual * paginasPorSegmento + 1;
        let finSegmento = Math.min(inicioSegmento + paginasPorSegmento - 1, totalPaginas);

        if (totalPaginas > 1) {
            paginador += "<div class='position-absolute bottom-0 start-50 translate-middle'>"
            paginador += "<nav aria-label='Page navigation example'>\n";
            paginador += "\t<ul class='pagination justify-content-center'>\n";

            if (this.paginaActual == 1) {
                paginador += "\t\t<li class='page-item disabled'><a class='page-link' href='#' tabindex='-1' aria-disabled='true'>Anterior</a></li>\n";
            } else {
                paginador += "\t\t<li class='page-item'><a class='page-link' href='javascript:paginar" + this.nombre + "(" + (this.paginaActual - 1) + ")'>Anterior</a></li>\n";
            }

            // Botón para segmento anterior
            if (inicioSegmento > 1) {
                paginador += "\t\t<li class='page-item'><a class='page-link' href='javascript:paginar" + this.nombre + "(" + (inicioSegmento - 1) + ")'>...</a></li>\n";
            }

            // Páginas del segmento actual
            for (let i = inicioSegmento; i <= finSegmento; i++) {
                if (i == this.paginaActual) {
                    paginador += "\t\t<li class='page-item active' aria-current='page'><a class='page-link' href='#'>" + i + "</a></li>\n";
                } else {
                    paginador += "\t\t<li class='page-item'><a class='page-link' href='javascript:paginar" + this.nombre + "(" + i + ")'>" + i + "</a></li>\n";
                }
            }

            // Botón para segmento siguiente
            if (finSegmento < totalPaginas) {
                paginador += "\t\t<li class='page-item'><a class='page-link' href='javascript:paginar" + this.nombre + "(" + (finSegmento + 1) + ")'>...</a></li>\n";
            }

            if (this.paginaActual == totalPaginas) {
                paginador += "\t\t<li class='page-item disabled'><a class='page-link' href='#' tabindex='-1' aria-disabled='true'>Siguiente</a></li>\n";
            } else {
                paginador += "\t\t<li class='page-item'><a class='page-link' href='javascript:paginar" + this.nombre + "(" + (this.paginaActual + 1) + ")'>Siguiente</a></li>\n";
            }

            paginador += "\t</ul>\n";
            paginador += "</nav>\n";
            paginador += "</div>"
            paginador += "<div class='d-lg-none text-center mt-3'>"
            paginador += "<button class='btn btn-primary h1' onclick='window.location.href=\"/\"'> <i class='bi-box-arrow-left h1 me-2'></i>Atrás</button>"
            paginador += "</div>"
        }
        return paginador;

    }

    getFunciones(home = '') {
        let html = '';
        html += '<script>\n'
        html += 'async function ordenar' + this.nombre + '(campo) {\n'
        html += '\ttry {\n'
        html += '\t\tconst response = await fetch("/' + this.rutaConsulta + '/ordenar", {\n'
        html += '\t\t\tmethod: "POST",\n'
        html += '\t\t\theaders: { "Content-Type": "application/json" },\n'
        html += '\t\t\tbody: JSON.stringify({campo: campo, tabla: "' + this.nombre + '"})});\n'
        if (home != '') {
            html += '\t\twindow.location.href = "' + home + '";\n'
        } else {
            html += '\t\twindow.location.reload();\n'
        }
        html += '\t\t}\n'
        html += '\tcatch (error) {\n'
        html += '\t\t\tconsole.error("Error:", error);\n'
        html += '\t\t}\n'
        html += '}\n'

        html += 'async function filtrar' + this.nombre + '(campo, filtro) {\n'
        html += 'var f = ""\n'
        html += 'if (filtro != "") {\n'
        html += 'f = document.getElementById(filtro).value\n'
        html += '}\n'
        html += '\ttry {\n'
        html += '\t\tconst response = await fetch("/' + this.rutaConsulta + '/filtrar", {\n'
        html += '\t\t\tmethod: "POST",\n'
        html += '\t\t\theaders: {"Content-Type": "application/json"},\n'
        html += '\t\t\tbody: JSON.stringify({'
        html += 'i: campo,'
        html += 'filtro: f,'
        html += 'tabla: "' + this.nombre + '"'
        html += '})})\n'
        if (home != '') {
            html += '\t\twindow.location.href = "' + home + '";\n'
        } else {
            html += '\t\twindow.location.reload();\n'
        }
        html += '\t\t}\n'
        html += '\tcatch (error) {\n'
        html += '\t\tconsole.error("Error:", error);\n'
        html += '\t}\n'
        html += '}\n'

        html += 'async function paginar' + this.nombre + '(pagina) {\n'
        html += '\ttry {\n'
        html += '\t\tconst response = await fetch("/' + this.rutaConsulta + '/paginar", {\n'
        html += '\t\t\tmethod: "POST",\n'
        html += '\t\t\theaders: { "Content-Type": "application/json" },\n'
        html += '\t\t\tbody: JSON.stringify({pagina: pagina, tabla: "' + this.nombre + '"})});\n'
        if (home != '') {
            html += '\t\twindow.location.href = "' + home + '";\n'
        } else {
            html += '\t\twindow.location.reload();\n'
        }
        html += '\t\t}\n'
        html += '\t\tcatch (error) {\n'
        html += '\t\t\tconsole.error("Error:", error);\n'
        html += '\t\t}\n'
        html += '\t}\n'

        html += '</script>\n'

        return html;
    }
}
module.exports = { Tabla };