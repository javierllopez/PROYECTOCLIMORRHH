module.exports = {
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
        let fechaAux = new Date(FechaDesde);
        let totalHoras = 0;
        let totalMinutos = 0;
        let totalMinutosParaMostrar = 0;

        while (fechaAux < FechaHasta) {

            if (fechaAux.getDay() !== 0 && fechaAux.getDay() !== 6) {
                if (fechaAux.getHours() >= 6 && fechaAux.getHours() < 22) {
                    totalMinutos++;
                }
            }
            if (fechaAux.getDay() === 6) {
                if (fechaAux.getHours() >= 6 && fechaAux.getHours() <= 13) {
                    totalMinutos++;
                }
            }
            fechaAux.setMinutes(fechaAux.getMinutes() + 1);
        }
        totalHoras = Math.floor(totalMinutos / 60);
        totalMinutosParaMostrar = totalMinutos % 60;

        //Devuelve un array con el total de minutos y el total de horas y minutos en formato cadena
        return [totalMinutos, `${String(totalHoras).padStart(2, '0')}:${String(totalMinutosParaMostrar).padStart(2, '0')}`];
    },
    TotalHoras100: function (FechaDesde, FechaHasta) {
        let fechaAux = new Date(FechaDesde);
        let totalHoras = 0;
        let totalMinutos = 0;
        let totalMinutosParaMostrar = 0;

        while (fechaAux < FechaHasta) {
            if (fechaAux.getDay() !== 0 && fechaAux.getDay() !== 6) {
                if (fechaAux.getHours() >= 22 || fechaAux.getHours() < 6) {
                    totalMinutos++;
                }
            }
            if (fechaAux.getDay() === 6) {
                if (fechaAux.getHours() < 6 || fechaAux.getHours() >= 13) {
                    totalMinutos++;
                }
            }
            if (fechaAux.getDay() === 0) {
                totalMinutos++;
            }

            fechaAux.setMinutes(fechaAux.getMinutes() + 1);
        }
        totalHoras = Math.floor(totalMinutos / 60);
        totalMinutosParaMostrar = totalMinutos % 60;

        //Devuelve un array con el total de minutos y el total de horas y minutos en formato cadena
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