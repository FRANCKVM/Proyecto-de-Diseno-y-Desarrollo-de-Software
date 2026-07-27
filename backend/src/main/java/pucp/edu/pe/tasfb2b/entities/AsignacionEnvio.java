package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "asignacion_envio")
public class AsignacionEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_asignacion")
    private Integer idAsignacion;

    @ManyToOne(optional = false)
    @JoinColumn(name = "id_envio", nullable = false)
    private SolicitudEnvio envio;

    @ManyToOne(optional = false)
    @JoinColumn(name = "id_ruta", nullable = false)
    private Ruta ruta;

    @Column(name = "cantidad_bolsas", nullable = false)
    private Integer cantidadBolsas;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false)
    private EstadoEnvio estado = EstadoEnvio.PLANIFICADO;

    @Column(name = "capacidad_origen_liberada")
    private Boolean capacidadOrigenLiberada = false;

    public AsignacionEnvio() {
    }

    public AsignacionEnvio(
            SolicitudEnvio envio,
            Ruta ruta,
            Integer cantidadBolsas,
            EstadoEnvio estado
    ) {
        this.envio = envio;
        this.ruta = ruta;
        this.cantidadBolsas = cantidadBolsas;
        this.estado = estado != null ? estado : EstadoEnvio.PLANIFICADO;
        this.capacidadOrigenLiberada = false;
    }

    public Integer getIdAsignacion() {
        return idAsignacion;
    }

    public void setIdAsignacion(Integer idAsignacion) {
        this.idAsignacion = idAsignacion;
    }

    public SolicitudEnvio getEnvio() {
        return envio;
    }

    public void setEnvio(SolicitudEnvio envio) {
        this.envio = envio;
    }

    public Ruta getRuta() {
        return ruta;
    }

    public void setRuta(Ruta ruta) {
        this.ruta = ruta;
    }

    public Integer getCantidadBolsas() {
        return cantidadBolsas;
    }

    public void setCantidadBolsas(Integer cantidadBolsas) {
        this.cantidadBolsas = cantidadBolsas;
    }

    public EstadoEnvio getEstado() {
        return estado != null ? estado : EstadoEnvio.PLANIFICADO;
    }

    public void setEstado(EstadoEnvio estado) {
        this.estado = estado != null ? estado : EstadoEnvio.PLANIFICADO;
    }

    public boolean isCapacidadOrigenLiberada() {
        return Boolean.TRUE.equals(capacidadOrigenLiberada);
    }

    public void setCapacidadOrigenLiberada(Boolean capacidadOrigenLiberada) {
        this.capacidadOrigenLiberada = Boolean.TRUE.equals(capacidadOrigenLiberada);
    }
}
