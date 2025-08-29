CREATE TABLE `liquidaciones` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `IdNovedadesE` int NOT NULL,
  `Periodo` date NOT NULL,
  `Sector` int NOT NULL,
  `IdLegajo` int NOT NULL,
  `Detalle` tinytext,
  `Monto` decimal(12,2) NOT NULL,
  `Vale` int NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
