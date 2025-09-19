CCREATE TABLE `ajustes` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `IdEmpleado` int DEFAULT NULL,
  `Descripcion` text,
  `Monto` decimal(12,2) DEFAULT NULL,
  `IdUsuario` int DEFAULT NULL,
  `TimeStamp` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
