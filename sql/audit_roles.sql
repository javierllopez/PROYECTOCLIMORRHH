CREATE TABLE audit_roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  rol_anterior VARCHAR(50) NOT NULL,
  rol_nuevo VARCHAR(50) NOT NULL,
  motivo ENUM('delegacion_programada','delegacion_manual','restauracion','ajuste_admin') NOT NULL,
  referencia VARCHAR(100) NULL,
  supervisor_original_id INT NULL,
  fecha_desde DATETIME NULL,
  fecha_hasta DATETIME NULL,
  ejecutado_por INT NULL,
  ip_origen VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_usuario_fecha (usuario_id, creado_en DESC),
  CONSTRAINT fk_audit_roles_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_audit_roles_ejecutor FOREIGN KEY (ejecutado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;