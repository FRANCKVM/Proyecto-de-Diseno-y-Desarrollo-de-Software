package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "aeropuerto")
public class Aeropuerto {

    @Id
    @Column(name = "codigo", nullable = false, length = 10)
    private String codigo;

    @Column(name = "ciudad", nullable = false, length = 100)
    private String ciudad;

    @Column(name = "region", nullable = false, length = 50)
    private String region;

    @Column(name = "pais", nullable = false, length = 100)
    private String pais;

    @Column(name = "alias", length = 100)
    private String alias;

    @Column(name = "desplazamiento_gmt", nullable = false)
    private Integer desplazamientoGMT;

    @Column(name = "capacidad", nullable = false)
    private Integer capacidad;

    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    public Aeropuerto() {
    }

    public Aeropuerto(String codigo, String ciudad, String region) {
        this.codigo = codigo;
        this.ciudad = ciudad;
        this.region = region;
        this.pais = "";
        this.alias = null;
        this.desplazamientoGMT = 0;
        this.capacidad = 0;
        this.latitud = 0.0;
        this.longitud = 0.0;
    }

    public Aeropuerto(String codigo, String ciudad, String region, Integer desplazamientoGMT, Integer capacidad) {
        this.codigo = codigo;
        this.ciudad = ciudad;
        this.region = region;
        this.pais = "";
        this.alias = null;
        this.desplazamientoGMT = desplazamientoGMT;
        this.capacidad = capacidad;
        this.latitud = 0.0;
        this.longitud = 0.0;
    }

    public Aeropuerto(
            String codigo,
            String ciudad,
            String region,
            String pais,
            String alias,
            Integer desplazamientoGMT,
            Integer capacidad,
            Double latitud,
            Double longitud
    ) {
        this.codigo = codigo;
        this.ciudad = ciudad;
        this.region = region;
        this.pais = pais;
        this.alias = alias;
        this.desplazamientoGMT = desplazamientoGMT;
        this.capacidad = capacidad;
        this.latitud = latitud;
        this.longitud = longitud;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public String getCiudad() {
        return ciudad;
    }

    public void setCiudad(String ciudad) {
        this.ciudad = ciudad;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getPais() {
        return pais;
    }

    public void setPais(String pais) {
        this.pais = pais;
    }

    public String getAlias() {
        return alias;
    }

    public void setAlias(String alias) {
        this.alias = alias;
    }

    public Integer getDesplazamientoGMT() {
        return desplazamientoGMT;
    }

    public void setDesplazamientoGMT(Integer desplazamientoGMT) {
        this.desplazamientoGMT = desplazamientoGMT;
    }

    public Integer getCapacidad() {
        return capacidad;
    }

    public void setCapacidad(Integer capacidad) {
        this.capacidad = capacidad;
    }

    public Double getLatitud() {
        return latitud;
    }

    public void setLatitud(Double latitud) {
        this.latitud = latitud;
    }

    public Double getLongitud() {
        return longitud;
    }

    public void setLongitud(Double longitud) {
        this.longitud = longitud;
    }

    public boolean tieneCapacidad(int maletas) {
        return capacidad != null && capacidad >= maletas;
    }

    public void descontarCapacidad(int maletas) {
        if (maletas < 0) {
            throw new IllegalArgumentException("La cantidad a descontar no puede ser negativa");
        }

        if (!tieneCapacidad(maletas)) {
            throw new IllegalStateException("No hay capacidad suficiente en el aeropuerto " + codigo);
        }

        capacidad -= maletas;
    }

    public void aumentarCapacidad(int maletas) {
        if (maletas < 0) {
            throw new IllegalArgumentException("La cantidad a aumentar no puede ser negativa");
        }

        if (capacidad == null) {
            capacidad = 0;
        }

        capacidad += maletas;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Aeropuerto aeropuerto)) return false;
        return Objects.equals(codigo, aeropuerto.codigo);
    }

    @Override
    public int hashCode() {
        return Objects.hash(codigo);
    }

    @Override
    public String toString() {
        return codigo + " (" + ciudad + ", " + region + ")";
    }
}