-- Local/dev only. Creates the database used by automated tests.
CREATE DATABASE IF NOT EXISTS gavran_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON gavran_test.* TO 'gavran'@'%';
FLUSH PRIVILEGES;
