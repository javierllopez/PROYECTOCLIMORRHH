// Solo helpers para Handlebars. Utilidades comunes van en lib/libreria.js
const { aLocalDesdeUtc, fechaHoraLocalAUtc } = require('./libreria');

module.exports = {
    ifeq: function(a, b, options){
        if (a == b) {
            return options.fn(this);
        }
        return options.inverse(this);
    },
    ifnoteq: function(a, b, options){
        if (a != b) {
            return options.fn(this);
        }
        return options.inverse(this);
    },
    ifmay: function (a, b, options) {
        if (a > b) {
            return options.fn(this);
        }
        return options.inverse(this);
    },
    ifmen: function (a, b, options) {
        if (a < b) {
            return options.fn(this);
        }
        return options.inverse(this);
    },
    minutosAHoras: function(minutos){
        let horas = Math.floor(minutos / 60);
        let minutosRestantes = minutos % 60;
        if (horas < 100) {
            return `${horas}:${String(minutosRestantes).padStart(2, '0')}`;
        } else if (horas < 1000) {
            return `${String(horas).padStart(3, '0')}:${String(minutosRestantes).padStart(2, '0')}`;
        } else {
            return `${String(horas).padStart(4, '0')}:${String(minutosRestantes).padStart(2, '0')}`;
        }
    },
    Periodo: function(fecha){
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        // Si viene como string 'YYYY-MM-DD', no usar new Date() para evitar corrimiento de mes por TZ
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            const [y, m] = fecha.split('-');
            const mes = meses[Number(m) - 1];
            return `${mes} ${y}`;
        }
        const d = new Date(fecha);
        const mes = meses[d.getMonth()];
        const ano = d.getFullYear();
        return `${mes} ${ano}`;
    },
    FechaDiaSem: function(fecha) {
        // Si viene como string 'YYYY-MM-DD', tratarlo como fecha de calendario (sin TZ)
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
            const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
            const f = new Date(y, m - 1, d); // fecha local sin desplazamientos
            const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            const dd = String(f.getDate()).padStart(2, '0');
            const mm = String(f.getMonth() + 1).padStart(2, '0');
            const aa = f.getFullYear();
            return `${dias[f.getDay()]}, ${dd}/${mm}/${aa}`;
        }
        // Para Date o strings con hora, convertir desde UTC a horario AR
        const d = aLocalDesdeUtc(fecha);
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
    },
    FechaCorta: function(fecha){
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
            const [y, m, d] = fecha.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        const d = aLocalDesdeUtc(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    },
    FechaYHora: function(fecha){
        const d = aLocalDesdeUtc(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        const hora = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
    },
    Hora: function(fecha){
        const d = aLocalDesdeUtc(fecha);
        const hora = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${hora}:${minutos}`;
    },
    // Nota: No exportamos conversores como helpers; que las rutas requieran desde libreria.js
    FechaIso: function(fecha) {
        const d = new Date(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${ano}-${mes}-${dia}`;
    },
    json: function(context){
        return JSON.stringify(context);
    },
    formatoMoneda: function (valor) {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
    },
    porcentaje: function (valor) {
        if (valor < 1) return `${(valor * 100).toFixed(2)}%`;
    },
    formatoNumero: function (valor) {
        return new Intl.NumberFormat('es-AR', {style: 'decimal', useGrouping: true}).format(valor);
    },
    sumArray: function(arr) {
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
    },
    HoraLocal: function(fecha) {
        if (!fecha) return '';
        const d = aLocalDesdeUtc(fecha);
        const horas = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${horas}:${minutos}`;
    }

}