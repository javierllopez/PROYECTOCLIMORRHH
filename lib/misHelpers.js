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
        const d = new Date(fecha);
        const mes = meses[d.getMonth()];
        const ano = d.getFullYear();
        return `${mes} ${ano}`;
    },
    FechaDiaSem: function(fecha) {
        const d = new Date(fecha);
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
    },
    FechaCorta: function(fecha){
        const d = new Date(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    },
    FechaYHora: function(fecha){
        const d = new Date(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        const hora = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${minutos}`;
    },
    Hora: function(fecha){
        const d = new Date(fecha);
        const hora = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${hora}:${minutos}`;
    },
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
        const d = new Date(fecha + 'Z');
        const horas = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${horas}:${minutos}`;
    }

}