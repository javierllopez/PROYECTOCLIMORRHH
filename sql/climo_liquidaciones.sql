CREATE TABLE `liquidaciones` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `IdNovedadesE` int NOT NULL,
  `Area` enum('Administrativa','Operativa') NOT NULL,
  `Periodo` date NOT NULL,
  `Sector` int NOT NULL,
  `IdEmpleado` int NOT NULL,
  `Detalle` tinytext,
  `Monto` decimal(12,2) NOT NULL,
  `Vale` int NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=267 DEFAULT CHARSET=latin1;
