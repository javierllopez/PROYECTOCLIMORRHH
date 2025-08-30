-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: localhost    Database: climo
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `novedadesr`
--

DROP TABLE IF EXISTS `novedadesr`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `novedadesr` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `IdNovedadesE` int NOT NULL,
  `Area` enum('Administrativa','Operativa') NOT NULL,
  `IdSector` int NOT NULL,
  `IdEmpleado` int NOT NULL,
  `Fecha` date NOT NULL,
  `Hs50` varchar(5) DEFAULT NULL,
  `Hs100` varchar(5) DEFAULT NULL,
  `GuardiasDiurnas` decimal(3,2) DEFAULT NULL,
  `GuardiasNocturnas` decimal(3,2) DEFAULT NULL,
  `GuardiasPasivas` decimal(3,2) DEFAULT NULL,
  `Monto` decimal(10,2) DEFAULT NULL,
  `IdGuardia` int DEFAULT NULL,
  `IdParcial` tinyint DEFAULT NULL,
  `IdNomina` int NOT NULL,
  `IdTurno` int NOT NULL,
  `IdCategoria` int NOT NULL,
  `IdEstado` int NOT NULL,
  `ObservacionesEstado` text,
  `IdSupervisor` int NOT NULL,
  `MinutosAl50` int DEFAULT NULL,
  `MinutosAl100` int DEFAULT NULL,
  `MinutosGD` int DEFAULT NULL,
  `MinutosGN` int DEFAULT NULL,
  `Inicio` datetime DEFAULT NULL,
  `Fin` datetime DEFAULT NULL,
  `IdMotivo` int DEFAULT NULL,
  `IdReemplazo` int DEFAULT NULL,
  `Observaciones` text,
  `CreadoPorAdmin` tinyint DEFAULT NULL,
  `Liquidado` tinyint DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-19 12:27:18
