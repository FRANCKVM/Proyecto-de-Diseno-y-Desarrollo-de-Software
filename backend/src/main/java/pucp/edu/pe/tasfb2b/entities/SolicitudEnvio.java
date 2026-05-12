package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "solicitud_envio")
public class SolicitudEnvio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_envio")
    private Integer idEnvio;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "hora", nullable = false)
    private LocalTime hora;

    @Column(name = "id_cliente", nullable = false)
    private Integer idCliente;

    @ManyToOne
    @JoinColumn(name = "id_ruta")
    private Ruta ruta;

    @ManyToOne
    @JoinColumn(name = "id_simulacion")
    private Simulacion simulacion;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "codigo_aeropuerto_origen",
            referencedColumnName = "codigo",
            nullable = false
    )
    private Aeropuerto origen;

    @ManyToOne(optional = false)
    @JoinColumn(
            name = "codigo_aeropuerto_destino",
            referencedColumnName = "codigo",
            nullable = false
    )
    private Aeropuerto destino;

    @Column(name = "contar_bolsas", nullable = false)
    private Integer contarBolsas;

    @Column(name = "dias_tiempo_maximo", nullable = false)
    private Double diasTiempoMaximo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false)
    private EstadoEnvio estado = EstadoEnvio.INGRESADO;

    public SolicitudEnvio() {
    }

    public SolicitudEnvio(Aeropuerto origen, Aeropuerto destino, Integer contarBolsas, Double diasTiempoMaximo) {
        this.fecha = LocalDate.now();
        this.hora = LocalTime.now();
        this.idCliente = 1;
        this.ruta = null;
        this.simulacion = null;
        this.origen = origen;
        this.destino = destino;
        this.contarBolsas = contarBolsas;
        this.diasTiempoMaximo = diasTiempoMaximo;
        this.estado = EstadoEnvio.INGRESADO;
    }

    public SolicitudEnvio(
            Integer idEnvio,
            LocalDate fecha,
            LocalTime hora,
            Integer idCliente,
            Aeropuerto origen,
            Aeropuerto destino,
            Integer contarBolsas,
            Double diasTiempoMaximo
    ) {
        this.idEnvio = idEnvio;
        this.fecha = fecha;
        this.hora = hora;
        this.idCliente = idCliente;
        this.ruta = null;
        this.simulacion = null;
        this.origen = origen;
        this.destino = destino;
        this.contarBolsas = contarBolsas;
        this.diasTiempoMaximo = diasTiempoMaximo;
        this.estado = EstadoEnvio.INGRESADO;
    }

    public SolicitudEnvio(
            Integer idEnvio,
            LocalDate fecha,
            LocalTime hora,
            Integer idCliente,
            Ruta ruta,
            Simulacion simulacion,
            Aeropuerto origen,
            Aeropuerto destino,
            Integer contarBolsas,
            Double diasTiempoMaximo
    ) {
        this.idEnvio = idEnvio;
        this.fecha = fecha;
        this.hora = hora;
        this.idCliente = idCliente;
        this.ruta = ruta;
        this.simulacion = simulacion;
        this.origen = origen;
        this.destino = destino;
        this.contarBolsas = contarBolsas;
        this.diasTiempoMaximo = diasTiempoMaximo;
        this.estado = EstadoEnvio.INGRESADO;
    }

    public SolicitudEnvio(
            Integer idEnvio,
            LocalDate fecha,
            LocalTime hora,
            Integer idCliente,
            Ruta ruta,
            Simulacion simulacion,
            Aeropuerto origen,
            Aeropuerto destino,
            Integer contarBolsas,
            Double diasTiempoMaximo,
            EstadoEnvio estado
    ) {
        this.idEnvio = idEnvio;
        this.fecha = fecha;
        this.hora = hora;
        this.idCliente = idCliente;
        this.ruta = ruta;
        this.simulacion = simulacion;
        this.origen = origen;
        this.destino = destino;
        this.contarBolsas = contarBolsas;
        this.diasTiempoMaximo = diasTiempoMaximo;
        this.estado = estado != null ? estado : EstadoEnvio.INGRESADO;
    }

    public Integer getIdEnvio() {
        return idEnvio;
    }

    public void setIdEnvio(Integer idEnvio) {
        this.idEnvio = idEnvio;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public void setFecha(LocalDate fecha) {
        this.fecha = fecha;
    }

    public LocalTime getHora() {
        return hora;
    }

    public void setHora(LocalTime hora) {
        this.hora = hora;
    }

    public Integer getIdCliente() {
        return idCliente;
    }

    public void setIdCliente(Integer idCliente) {
        this.idCliente = idCliente;
    }

    public Ruta getRuta() {
        return ruta;
    }

    public void setRuta(Ruta ruta) {
        this.ruta = ruta;
    }

    public Integer getIdRuta() {
        return ruta != null ? ruta.getIdRuta() : null;
    }

    public Integer getIdSimulacion() {
        return simulacion != null ? simulacion.getIdSimulacion() : null;
    }

    public Aeropuerto getOrigen() {
        return origen;
    }

    public Simulacion getSimulacion() {
        return simulacion;
    }

    public void setSimulacion(Simulacion simulacion) {
        this.simulacion = simulacion;
    }

    public void setOrigen(Aeropuerto origen) {
        this.origen = origen;
    }

    public Aeropuerto getDestino() {
        return destino;
    }

    public void setDestino(Aeropuerto destino) {
        this.destino = destino;
    }

    public Integer getContarBolsas() {
        return contarBolsas;
    }

    public void setContarBolsas(Integer contarBolsas) {
        this.contarBolsas = contarBolsas;
    }

    public Double getDiasTiempoMaximo() {
        return diasTiempoMaximo;
    }

    public void setDiasTiempoMaximo(Double diasTiempoMaximo) {
        this.diasTiempoMaximo = diasTiempoMaximo;
    }

    public EstadoEnvio getEstado() {
        return estado;
    }

    public void setEstado(EstadoEnvio estado) {
        this.estado = estado;
    }

    public LocalDateTime getFechaHoraRegistro() {
        if (fecha == null || hora == null) {
            return null;
        }
        return LocalDateTime.of(fecha, hora);
    }

    @Override
    public String toString() {
        return "SolicitudEnvio{" +
                "idEnvio=" + idEnvio +
                ", fecha=" + fecha +
                ", hora=" + hora +
                ", idCliente=" + idCliente +
                ", idRuta=" + getIdRuta() +
                ", idSimulacion=" + (simulacion != null ? simulacion.getIdSimulacion() : null) +
                ", origen=" + (origen != null ? origen.getCodigo() : null) +
                ", destino=" + (destino != null ? destino.getCodigo() : null) +
                ", contarBolsas=" + contarBolsas +
                ", diasTiempoMaximo=" + diasTiempoMaximo +
                ", estado=" + estado +
                '}';
    }
}
