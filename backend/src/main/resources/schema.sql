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
