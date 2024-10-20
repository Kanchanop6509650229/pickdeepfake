CREATE DATABASE IF NOT EXISTS image_detection_system;

USE image_detection_system;

CREATE TABLE IF NOT EXISTS user_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    image_name VARCHAR(255),
    image LONGBLOB,
    prediction_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS django_session (
    session_key varchar(40) NOT NULL,
    session_data longtext NOT NULL,
    expire_date datetime(6) NOT NULL,
    PRIMARY KEY (session_key),
    KEY django_session_expire_date_a5c62663 (expire_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;