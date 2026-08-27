-- phpMyAdmin SQL Dump
-- Host: 127.0.0.1
-- Generation Time: Jul 11, 2026
-- Server version: 10.4.24-MariaDB
-- PHP Version: 8.1.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Database: `agriconnect_db`
CREATE DATABASE IF NOT EXISTS `agriconnect_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `agriconnect_db`;

-- --------------------------------------------------------

CREATE TABLE `farmers` (
  `mobile` varchar(15) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `village` varchar(100) NOT NULL,
  `taluka` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `farmers` (`mobile`, `password`, `name`, `email`, `village`, `taluka`) VALUES
('8625098532', 'password', 'Rohit Bhamare', 'rohit@gmail.com', 'Thalner', 'thalner'),
('9988776655', 'password', 'Baldev Singh', 'baldev@gmail.com', 'Shirpur', 'shirpur');

-- --------------------------------------------------------

CREATE TABLE `surveyors` (
  `mobile` varchar(15) NOT NULL,
  `emp_id` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `taluka` varchar(100) NOT NULL,
  `node` varchar(100) NOT NULL,
  `rating` decimal(3,1) DEFAULT 4.5,
  `jobs_completed` int(11) DEFAULT 0,
  `status` enum('Available','Busy','Inactive') DEFAULT 'Available',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`mobile`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `surveyors` (`mobile`, `emp_id`, `password`, `name`, `taluka`, `node`, `rating`, `jobs_completed`, `status`) VALUES
('7276025116', 'AGR-2026-001', 'password', 'Gaurav Khadse', 'chopda', 'Chopda', '4.8', 5, 'Available'),
('9876543210', 'AGR-2026-002', 'password', 'Ramesh Kumar', 'thalner', 'Thalner', '4.9', 12, 'Available');

-- --------------------------------------------------------

CREATE TABLE `farms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `farmer_mobile` varchar(15) NOT NULL,
  `name` varchar(150) NOT NULL,
  `location` varchar(200) NOT NULL,
  `area` decimal(10,2) NOT NULL,
  `survey_type` varchar(100) NOT NULL,
  `cost` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

CREATE TABLE `bookings` (
  `id` varchar(50) NOT NULL,
  `farmer_mobile` varchar(15) NOT NULL,
  `farmer_name` varchar(100) NOT NULL,
  `surveyor_mobile` varchar(15) NOT NULL,
  `surveyor_name` varchar(100) NOT NULL,
  `farm_name` varchar(150) NOT NULL,
  `survey_type` varchar(100) NOT NULL,
  `location` varchar(200) NOT NULL,
  `area` decimal(10,2) NOT NULL,
  `cost` int(11) NOT NULL,
  `distance` decimal(10,2) DEFAULT NULL,
  `status` enum('Assigned','Accepted','Completed','Declined') DEFAULT 'Assigned',
  `payment_status` enum('Unpaid','Paid') DEFAULT 'Unpaid',
  `schedule_date` date DEFAULT NULL,
  `schedule_time` time DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `report_lat` decimal(10,6) DEFAULT NULL,
  `report_lng` decimal(10,6) DEFAULT NULL,
  `report_acreage` decimal(10,2) DEFAULT NULL,
  `report_obs` text DEFAULT NULL,
  `report_map_image` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

CREATE TABLE `candidates` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `mobile` varchar(15) NOT NULL,
  `email` varchar(100) NOT NULL,
  `aadhaar` varchar(20) NOT NULL,
  `qualification` varchar(100) NOT NULL,
  `experience` int(11) NOT NULL,
  `taluka` varchar(100) NOT NULL,
  `license_no` varchar(50) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Submitted',
  `employeeId` varchar(50) DEFAULT NULL,
  `interview_score` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;
