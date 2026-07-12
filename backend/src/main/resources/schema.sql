CREATE TABLE IF NOT EXISTS vuelo_ocurrencia (
    id_ocurrencia BIGINT NOT NULL AUTO_INCREMENT,
    version BIGINT NOT NULL DEFAULT 0,
    id_vuelo INT NOT NULL,
    fecha_hora_salida DATETIME NOT NULL,
    fecha_hora_llegada DATETIME NOT NULL,
    capacidad INT NOT NULL,
    capacidad_usada INT NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO',
    PRIMARY KEY (id_ocurrencia),
    CONSTRAINT uk_vuelo_ocurrencia_operativa UNIQUE (id_vuelo, fecha_hora_salida),
    CONSTRAINT fk_vuelo_ocurrencia_vuelo FOREIGN KEY (id_vuelo) REFERENCES vuelo (id_vuelo)
);

SET @add_vuelo_ocurrencia_version = IF(
    (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'vuelo_ocurrencia'
          AND COLUMN_NAME = 'version'
    ) = 0,
    'ALTER TABLE vuelo_ocurrencia ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER id_ocurrencia',
    'SELECT 1'
);
PREPARE add_vuelo_ocurrencia_version_stmt FROM @add_vuelo_ocurrencia_version;
EXECUTE add_vuelo_ocurrencia_version_stmt;
DEALLOCATE PREPARE add_vuelo_ocurrencia_version_stmt;

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

CREATE TABLE IF NOT EXISTS resultado_simulacion (
    id_resultado INT NOT NULL AUTO_INCREMENT,
    id_simulacion INT NOT NULL,
    resultado_periodo_json LONGTEXT NOT NULL,
    resultado_colapso_json LONGTEXT NOT NULL,
    PRIMARY KEY (id_resultado),
    CONSTRAINT uk_resultado_simulacion UNIQUE (id_simulacion),
    CONSTRAINT fk_resultado_simulacion FOREIGN KEY (id_simulacion) REFERENCES simulacion(id_simulacion)
);
