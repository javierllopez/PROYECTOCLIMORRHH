-- Script de alter para alinear la tabla `liquidaciones` en otros entornos
-- Asegurate de revisar antes de ejecutar en producción.

-- Agregar columna IdNovedadesE si no existe
ALTER TABLE `liquidaciones`
  ADD COLUMN `IdNovedadesE` INT NOT NULL AFTER `Id`;

-- Cambiar tipo de Periodo a DATE si hoy es DATETIME
ALTER TABLE `liquidaciones`
  MODIFY COLUMN `Periodo` DATE NOT NULL;

-- Opcional: índices útiles
CREATE INDEX `idx_liq_periodo` ON `liquidaciones`(`Periodo`);
CREATE INDEX `idx_liq_sector_legajo` ON `liquidaciones`(`Sector`, `Legajo`);

-- Opcional: FK a encabezado de novedades
-- Asegurate que `novedadese`.`Id` existe
-- ALTER TABLE `liquidaciones`
--   ADD CONSTRAINT `fk_liq_novedadese`
--   FOREIGN KEY (`IdNovedadesE`) REFERENCES `novedadese`(`Id`) ON DELETE RESTRICT ON UPDATE CASCADE;
