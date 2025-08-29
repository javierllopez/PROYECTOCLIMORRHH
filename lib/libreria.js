const { toZonedTime, fromZonedTime } = require('date-fns-tz');
const ZONA_AR = 'America/Argentina/Buenos_Aires';

module.exports = {
    // Conversores de zona horaria (UTC <-> AR)
    aLocalDesdeUtc: function (dateOrString) {
        if (!dateOrString) return '';
        const d = typeof dateOrString === 'string' ? new Date(dateOrString) : dateOrString;
        return toZonedTime(d, ZONA_AR);
    },
    fechaHoraLocalAUtc: function (fechaStr, horaStr) {
        if (!fechaStr) return null;
        // Si fechaStr es un objeto Date, conviértelo a string en formato 'yyyy-MM-dd'
        let fechaLocal;
        if (fechaStr instanceof Date) {
            const year = fechaStr.getFullYear();
            const month = String(fechaStr.getMonth() + 1).padStart(2, '0');
            const day = String(fechaStr.getDate()).padStart(2, '0');
            fechaLocal = `${year}-${month}-${day}`;
        } else {
            fechaLocal = fechaStr;
        }
        const local = `${fechaLocal} ${horaStr || '00:00'}`;
        return fromZonedTime(local, ZONA_AR);
    },

    cBool: function (valor) {
        if (valor === 'on' || valor === 'true' || valor === 'T' || valor === 't') {
            return true;
        } else {
            if (valor === 'off' || valor === 'false' || valor === 'F' || valor === 'f') {
                return false;
            }
        }
    },
    cInt: function (valor) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) {
            return 0;
        } else {
            return parseInt(valor);
        }
    },
    FechaSqlAFecha: function (mysqlDate) {

        if (!mysqlDate) return null;


        return new Date(mysqlDate);
    },
    FechaASqlFecha: function (fecha) {
        if (!(fecha instanceof Date)) {
            throw new Error('El argumento debe ser una instancia de Date');
        }
        const year = fecha.getUTCFullYear();
        const month = String(fecha.getUTCMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(fecha.getUTCDate()).padStart(2, '0'); // Days are one-based
        const hours = String(fecha.getUTCHours()).padStart(2, '0');
        const minutes = String(fecha.getUTCMinutes()).padStart(2, '0');
        const seconds = String(fecha.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },
    FechaSqlAFechaCorta: function (mysqlDate) {
        if (!mysqlDate) return null;
        const fecha = new Date(mysqlDate);

        const year = fecha.getUTCFullYear();
        const month = String(fecha.getUTCMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(fecha.getUTCDate()).padStart(2, '0'); // Days are one-based

        return `${day}/${month}/${year}`;
    },
    FechaHTMLaFecha: function (fechaStr) {
        // Convierte "yyyy-mm-dd" a objeto Date
        if (!fechaStr) return null;
        const [year, month, day] = fechaStr.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    },
    FechaYHora: function (fecha) {
        if (!(fecha instanceof Date)) {
            throw new Error('El argumento debe ser una instancia de Date');
        }
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(fecha.getDate()).padStart(2, '0'); // Days are one-based
        const hours = String(fecha.getHours()).padStart(2, '0');
        const minutes = String(fecha.getMinutes()).padStart(2, '0');

        const diasSemana = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
        const diaSemana = diasSemana[fecha.getDay()];
        return `${diaSemana} ${day}/${month}/${year} ${hours}:${minutes}`;
    },
    FechaCorta: function (fecha) {
        if (!(fecha instanceof Date)) {
            throw new Error('El argumento debe ser una instancia de Date');
        }
        const diasSemana = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
        const diaSemana = diasSemana[fecha.getDay()];
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(fecha.getDate()).padStart(2, '0'); // Days are one-based

        return `${diaSemana} ${day}/${month}/${year}`;
    },
    FormatearFecha: function (fechaStr) {
        // Extraer la parte de la fecha (YYYY-MM-DD)
        const fechaISO = fechaStr.split(' ')[0];
        const [year, month, day] = fechaISO.split('-');
        return `${day}/${month}/${year}`;
    },

    // Ejemplo de uso:
    // const resultado = formatearFecha('2025-05-01 Thu Jan 01 1970 06:00:00 GMT-0300 (hora estándar de Argentina)');
    // resultado: "01/05/2025"
    Periodo: function (mes, ano) {
        const meses = [
            'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
        ];
        if (mes < 1 || mes > 12) {
            throw new Error('El mes debe estar entre 1 y 12');
        }
        return `${meses[mes - 1]} ${ano}`;
    },
    TotalHoras50: function (FechaDesde, FechaHasta) {
        let actual = new Date(FechaDesde);
        const fin = new Date(FechaHasta);
        let totalMinutos = 0;
        while (actual < fin) {
            const local = toZonedTime(actual, ZONA_AR);
            const day = local.getDay();
            const hour = local.getHours();
            if (day !== 0 && day !== 6) {
                if (hour >= 6 && hour < 22) totalMinutos++;
            }
            if (day === 6) {
                if (hour >= 6 && hour < 13) totalMinutos++;
            }
            actual = new Date(actual.getTime() + 60000); // +1 minuto en UTC
        }
        const totalHoras = Math.floor(totalMinutos / 60);
        const totalMinutosParaMostrar = totalMinutos % 60;
        return [totalMinutos, `${String(totalHoras).padStart(2, '0')}:${String(totalMinutosParaMostrar).padStart(2, '0')}`];
    },
    TotalHoras100: function (FechaDesde, FechaHasta) {
        let actual = new Date(FechaDesde);
        const fin = new Date(FechaHasta);
        let totalMinutos = 0;
        while (actual < fin) {
            const local = toZonedTime(actual, ZONA_AR);
            const day = local.getDay();
            const hour = local.getHours();
            if (day !== 0 && day !== 6) {
                if (hour >= 22 || hour < 6) totalMinutos++;
            }
            if (day === 6) {
                if (hour < 6 || hour >= 13) totalMinutos++;
            }
            if (day === 0) totalMinutos++;
            actual = new Date(actual.getTime() + 60000);
        }
        const totalHoras = Math.floor(totalMinutos / 60);
        const totalMinutosParaMostrar = totalMinutos % 60;
        return [totalMinutos, `${String(totalHoras).padStart(2, '0')}:${String(totalMinutosParaMostrar).padStart(2, '0')}`];
    },
    ExtraerHora: function (fecha) {
        // Convierte la fecha a hora local antes de extraer horas y minutos
        const localFecha = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
        const hours = String(localFecha.getHours()).padStart(2, '0');
        const minutes = String(localFecha.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },
    DifHoras: function (fechaDesde, fechaHasta) {
        const diffMs = fechaHasta - fechaDesde;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        return diffHrs;
    }
}