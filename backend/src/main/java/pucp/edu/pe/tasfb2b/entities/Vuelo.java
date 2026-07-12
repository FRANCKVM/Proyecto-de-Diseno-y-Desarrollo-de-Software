package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "vuelo")
public class Vuelo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_vuelo")
    private Integer idVuelo;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "codigo_aeropuerto_desde",
            referencedColumnName = "codigo",
            nullable = false
    )
    private Aeropuerto desde;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "codigo_aeropuerto_hasta",
            referencedColumnName = "codigo",
            nullable = false
    )
    private Aeropuerto hasta;

    @Column(name = "tiempo_viajar_dias", nullable = false)
    private Double tiempoViajarDias;

    @Column(name = "capacidad", nullable = false)
    private Integer capacidad;

    @Column(name = "salida_utc_min", nullable = false)
    private Integer salidaUtcMin;

    @Column(name = "llegada_utc_min", nullable = false)
    private Integer llegadaUtcMin;

    public Vuelo() {
    }

    public Vuelo(
            Aeropuerto desde,
            Aeropuerto hasta,
            Double tiempoViajarDias,
            Integer capacidad,
            Integer salidaUtcMin,
            Integer llegadaUtcMin
    ) {
        this.desde = desde;
        this.hasta = hasta;
        this.tiempoViajarDias = tiempoViajarDias;
        this.capacidad = capacidad;
        this.salidaUtcMin = salidaUtcMin;
        this.llegadaUtcMin = llegadaUtcMin;
    }

    public Integer getIdVuelo() {
        return idVuelo;
    }

    public void setIdVuelo(Integer idVuelo) {
        this.idVuelo = idVuelo;
    }

    public Aeropuerto getDesde() {
        return desde;
    }

    public void setDesde(Aeropuerto desde) {
        this.desde = desde;
    }

    public Aeropuerto getHasta() {
        return hasta;
    }

    public void setHasta(Aeropuerto hasta) {
        this.hasta = hasta;
    }

    public Double getTiempoViajarDias() {
        return tiempoViajarDias;
    }

    public void setTiempoViajarDias(Double tiempoViajarDias) {
        this.tiempoViajarDias = tiempoViajarDias;
    }

    public Integer getCapacidad() {
        return capacidad;
    }

    public void setCapacidad(Integer capacidad) {
        this.capacidad = capacidad;
    }

    public Integer getSalidaUtcMin() {
        return salidaUtcMin;
    }

    public void setSalidaUtcMin(Integer salidaUtcMin) {
        this.salidaUtcMin = salidaUtcMin;
    }

    public Integer getLlegadaUtcMin() {
        return llegadaUtcMin;
    }

    public void setLlegadaUtcMin(Integer llegadaUtcMin) {
        this.llegadaUtcMin = llegadaUtcMin;
    }

    @Override
    public String toString() {
        return desde.getCodigo() + " -> " + hasta.getCodigo() +
                " | tiempo=" + tiempoViajarDias +
                " | salidaUTC=" + salidaUtcMin +
                " | llegadaUTC=" + llegadaUtcMin;
    }
}
