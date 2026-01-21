CREATE TABLE delegaciones_supervisor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supervisor_id INT NOT NULL,
  delegado_id INT NOT NULL,
  fecha_desde DATETIME NOT NULL,
  fecha_hasta DATETIME NULL,
  rol_supervisor_original VARCHAR(50) NOT NULL,
  estado ENUM('programada','activa','finalizada','revocada') NOT NULL DEFAULT 'programada',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_deleg_sup_supervisor FOREIGN KEY (supervisor_id) REFERENCES usuarios(id),
  CONSTRAINT fk_deleg_sup_delegado FOREIGN KEY (delegado_id) REFERENCES usuarios(id),
  CONSTRAINT chk_deleg_sup_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;