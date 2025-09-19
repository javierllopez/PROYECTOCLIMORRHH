CREATE TABLE `ajustes_historico` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `IdNovedadesE` int DEFAULT NULL,
  `IdEmpleado` int DEFAULT NULL,
  `Descripcion` text,
  `Monto` decimal(12,2) DEFAULT NULL,
  `IdUsuario` int DEFAULT NULL,
  `TimeStamp` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
