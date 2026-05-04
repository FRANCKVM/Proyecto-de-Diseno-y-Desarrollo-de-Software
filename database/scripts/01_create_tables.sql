CREATE DATABASE IF NOT EXISTS tasfb2b;
USE tasfb2b;

DROP TABLE IF EXISTS ruta_vuelo;
DROP TABLE IF EXISTS solicitud_envio;
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
    capacidad_usada INT NOT NULL DEFAULT 0,
    cancelado BOOLEAN NOT NULL DEFAULT FALSE,

    salida_utc_min INT NOT NULL,
    llegada_utc_min INT NOT NULL,

    CONSTRAINT fk_vuelo_desde
        FOREIGN KEY (codigo_aeropuerto_desde)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT fk_vuelo_hasta
        FOREIGN KEY (codigo_aeropuerto_hasta)
        REFERENCES aeropuerto(codigo),

    CONSTRAINT chk_vuelo_capacidad
        CHECK (capacidad >= 0),

    CONSTRAINT chk_vuelo_capacidad_usada
        CHECK (capacidad_usada >= 0 AND capacidad_usada <= capacidad),

    CONSTRAINT chk_vuelo_aeropuertos_distintos
        CHECK (codigo_aeropuerto_desde <> codigo_aeropuerto_hasta)
);

CREATE TABLE ruta (
    id_ruta INT AUTO_INCREMENT PRIMARY KEY,

    tiempo_total DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    costo DECIMAL(10, 4) NOT NULL DEFAULT 999999.9999,
    factible BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE ruta_vuelo (
    id_ruta INT NOT NULL,
    id_vuelo INT NOT NULL,
    orden INT NOT NULL,

    PRIMARY KEY (id_ruta, orden),

    CONSTRAINT fk_ruta_vuelo_ruta
        FOREIGN KEY (id_ruta)
        REFERENCES ruta(id_ruta)
        ON DELETE CASCADE,

    CONSTRAINT fk_ruta_vuelo_vuelo
        FOREIGN KEY (id_vuelo)
        REFERENCES vuelo(id_vuelo)
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

    estado ENUM('INGRESADO', 'EN_PROCESO', 'COMPLETADO') 
        NOT NULL DEFAULT 'INGRESADO',

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