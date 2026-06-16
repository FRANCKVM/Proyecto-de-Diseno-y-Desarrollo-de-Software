CREATE TABLE IF NOT EXISTS vuelo_cancelacion (
    id_cancelacion INT NOT NULL AUTO_INCREMENT,
    id_vuelo INT NOT NULL,
    fecha_hora_salida DATETIME NOT NULL,
    fecha_hora_cancelacion DATETIME NOT NULL,
    fecha_hora_creacion DATETIME NOT NULL,
    PRIMARY KEY (id_cancelacion),
    CONSTRAINT uk_vuelo_cancelacion_ocurrencia UNIQUE (id_vuelo, fecha_hora_salida),
    CONSTRAINT fk_vuelo_cancelacion_vuelo
        FOREIGN KEY (id_vuelo)
        REFERENCES vuelo (id_vuelo)
);

SET @add_cancelaciones_vuelos = IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'simulacion'
          AND COLUMN_NAME = 'cancelaciones_vuelos'
    ) = 0,
    'ALTER TABLE simulacion ADD COLUMN cancelaciones_vuelos INT DEFAULT 0',
    'SELECT 1'
);
PREPARE add_cancelaciones_vuelos_stmt FROM @add_cancelaciones_vuelos;
EXECUTE add_cancelaciones_vuelos_stmt;
DEALLOCATE PREPARE add_cancelaciones_vuelos_stmt;

SET @add_duracion_simulacion_minutos = IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'simulacion'
          AND COLUMN_NAME = 'duracion_simulacion_minutos'
    ) = 0,
    'ALTER TABLE simulacion ADD COLUMN duracion_simulacion_minutos BIGINT NULL',
    'SELECT 1'
);
PREPARE add_duracion_simulacion_minutos_stmt FROM @add_duracion_simulacion_minutos;
EXECUTE add_duracion_simulacion_minutos_stmt;
DEALLOCATE PREPARE add_duracion_simulacion_minutos_stmt;

CREATE TABLE IF NOT EXISTS asignacion_envio (
    id_asignacion INT NOT NULL AUTO_INCREMENT,
    id_envio INT NOT NULL,
    id_ruta INT NOT NULL,
    cantidad_bolsas INT NOT NULL,
    estado VARCHAR(30) NOT NULL,
    PRIMARY KEY (id_asignacion),
    INDEX idx_asignacion_envio_envio (id_envio),
    INDEX idx_asignacion_envio_ruta (id_ruta),
    CONSTRAINT fk_asignacion_envio_envio
        FOREIGN KEY (id_envio)
        REFERENCES solicitud_envio (id_envio),
    CONSTRAINT fk_asignacion_envio_ruta
        FOREIGN KEY (id_ruta)
        REFERENCES ruta (id_ruta)
);
