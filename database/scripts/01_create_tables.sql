CREATE DATABASE IF NOT EXISTS tasfb2b;
USE tasfb2b;

DROP TABLE IF EXISTS resultado_simulacion;
DROP TABLE IF EXISTS asignacion_envio;
DROP TABLE IF EXISTS vuelo_cancelacion;
DROP TABLE IF EXISTS ruta_vuelo;
DROP TABLE IF EXISTS vuelo_ocurrencia;
DROP TABLE IF EXISTS solicitud_envio;
DROP TABLE IF EXISTS simulacion;
DROP TABLE IF EXISTS ruta;
DROP TABLE IF EXISTS vuelo;
DROP TABLE IF EXISTS aeropuerto;

CREATE TABLE aeropuerto (
    codigo VARCHAR(10) PRIMARY KEY,
    ciudad VARCHAR(100) NOT NULL,
    region VARCHAR(50) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    alias VARCHAR(100),

    desplazamiento_gmt INT NOT NULL,
    capacidad INT NOT NULL,

    latitud DECIMAL(10, 7),
    longitud DECIMAL(10, 7),

    CONSTRAINT chk_aeropuerto_capacidad
        CHECK (capacidad >= 0)
);

CREATE TABLE vuelo (
    id_vuelo INT AUTO_INCREMENT PRIMARY KEY,

    codigo_aeropuerto_desde VARCHAR(10) NOT NULL,
    codigo_aeropuerto_hasta VARCHAR(10) NOT NULL,

    tiempo_viajar_dias DECIMAL(10, 4) NOT NULL,
    capacidad INT NOT NULL,

    salida_utc_min INT NOT NULL,
    llegada_utc_min INT NOT NULL,

    CONSTRAINT fk_vuelo_desde
        FOREIGN KEY (codigo_aeropuerto_desde)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT fk_vuelo_hasta
        FOREIGN KEY (codigo_aeropuerto_hasta)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT chk_vuelo_capacidad CHECK (capacidad >= 0),

    CONSTRAINT chk_vuelo_aeropuertos_distintos
        CHECK (codigo_aeropuerto_desde <> codigo_aeropuerto_hasta)
);

CREATE TABLE vuelo_ocurrencia (
    id_ocurrencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    id_vuelo INT NOT NULL,
    fecha_hora_salida DATETIME NOT NULL,
    fecha_hora_llegada DATETIME NOT NULL,
    capacidad INT NOT NULL,
    capacidad_usada INT NOT NULL DEFAULT 0,
    estado ENUM('PROGRAMADO', 'EN_VUELO', 'COMPLETADO', 'CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
    CONSTRAINT uk_vuelo_ocurrencia_operativa UNIQUE (id_vuelo, fecha_hora_salida),
    CONSTRAINT fk_vuelo_ocurrencia_vuelo FOREIGN KEY (id_vuelo) REFERENCES vuelo(id_vuelo),
    CONSTRAINT chk_ocurrencia_capacidad CHECK (capacidad >= 0),
    CONSTRAINT chk_ocurrencia_capacidad_usada CHECK (capacidad_usada >= 0 AND capacidad_usada <= capacidad)
);

CREATE INDEX idx_vuelo_ocurrencia_salida ON vuelo_ocurrencia(fecha_hora_salida);

CREATE TABLE ruta (
    id_ruta INT AUTO_INCREMENT PRIMARY KEY,

    tiempo_total DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    costo DECIMAL(10, 4) NOT NULL DEFAULT 999999.9999,
    factible BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE ruta_vuelo (
    id_ruta INT NOT NULL,
    id_ocurrencia BIGINT NOT NULL,
    orden INT NOT NULL,

    PRIMARY KEY (id_ruta, orden),

    CONSTRAINT fk_ruta_vuelo_ruta
        FOREIGN KEY (id_ruta)
        REFERENCES ruta(id_ruta)
        ON DELETE CASCADE,

    CONSTRAINT fk_ruta_vuelo_ocurrencia
        FOREIGN KEY (id_ocurrencia)
        REFERENCES vuelo_ocurrencia(id_ocurrencia)
);

CREATE INDEX idx_ruta_vuelo_ocurrencia ON ruta_vuelo(id_ocurrencia);

CREATE TABLE simulacion (
    id_simulacion INT AUTO_INCREMENT PRIMARY KEY,
    k INT NOT NULL,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    cancelaciones_vuelos INT NOT NULL DEFAULT 0,
    duracion_simulacion_minutos BIGINT NULL,

    CONSTRAINT chk_simulacion_k
        CHECK (k > 0)
);

CREATE TABLE resultado_simulacion (
    id_resultado INT AUTO_INCREMENT PRIMARY KEY,
    id_simulacion INT NOT NULL UNIQUE,
    resultado_periodo_json LONGTEXT NOT NULL,
    resultado_colapso_json LONGTEXT NOT NULL,
    CONSTRAINT fk_resultado_simulacion FOREIGN KEY (id_simulacion) REFERENCES simulacion(id_simulacion)
);

CREATE TABLE solicitud_envio (
    id_envio INT AUTO_INCREMENT PRIMARY KEY,

    fecha DATE NOT NULL,
    hora TIME NOT NULL,

    id_cliente INT NOT NULL,
    id_ruta INT NULL,

    codigo_aeropuerto_origen VARCHAR(10) NOT NULL,
    codigo_aeropuerto_destino VARCHAR(10) NOT NULL,

    contar_bolsas INT NOT NULL,
    dias_tiempo_maximo DECIMAL(10, 4) NOT NULL,

    estado ENUM('REGISTRADO', 'PLANIFICADO', 'EN_TRANSITO', 'COMPLETADO', 'ENTREGADO')
        NOT NULL DEFAULT 'REGISTRADO',

    CONSTRAINT fk_solicitud_ruta
        FOREIGN KEY (id_ruta)
        REFERENCES ruta(id_ruta)
        ON DELETE SET NULL,

    CONSTRAINT fk_solicitud_origen
        FOREIGN KEY (codigo_aeropuerto_origen)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT fk_solicitud_destino
        FOREIGN KEY (codigo_aeropuerto_destino)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT chk_solicitud_bolsas
        CHECK (contar_bolsas > 0),

    CONSTRAINT chk_solicitud_tiempo
        CHECK (dias_tiempo_maximo > 0),

    CONSTRAINT chk_solicitud_aeropuertos_distintos
        CHECK (codigo_aeropuerto_origen <> codigo_aeropuerto_destino)
);
