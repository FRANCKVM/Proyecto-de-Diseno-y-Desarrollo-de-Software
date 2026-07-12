package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "vuelo_ocurrencia",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_vuelo_ocurrencia_operativa",
                columnNames = {"id_vuelo", "fecha_hora_salida"}
        )
)
public class VueloOcurrencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_ocurrencia")
    private Long idOcurrencia;

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_vuelo", nullable = false)
    private Vuelo vuelo;

    @Column(name = "fecha_hora_salida", nullable = false)
    private LocalDateTime fechaHoraSalida;

    @Column(name = "fecha_hora_llegada", nullable = false)
    private LocalDateTime fechaHoraLlegada;

    @Column(name = "capacidad", nullable = false)
    private Integer capacidad;

    @Column(name = "capacidad_usada", nullable = false)
    private Integer capacidadUsada = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 20)
    private EstadoVueloOcurrencia estado = EstadoVueloOcurrencia.PROGRAMADO;

    public VueloOcurrencia() {
    }

    public VueloOcurrencia(
            Vuelo vuelo,
            LocalDateTime fechaHoraSalida,
            LocalDateTime fechaHoraLlegada,
            Integer capacidad
    ) {
        this.vuelo = vuelo;
        this.fechaHoraSalida = fechaHoraSalida;
        this.fechaHoraLlegada = fechaHoraLlegada;
        this.capacidad = capacidad;
        this.capacidadUsada = 0;
        this.estado = EstadoVueloOcurrencia.PROGRAMADO;
    }

    public Long getIdOcurrencia() { return idOcurrencia; }
    public void setIdOcurrencia(Long idOcurrencia) { this.idOcurrencia = idOcurrencia; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version != null ? version : 0L; }
    public Vuelo getVuelo() { return vuelo; }
    public void setVuelo(Vuelo vuelo) { this.vuelo = vuelo; }
    public LocalDateTime getFechaHoraSalida() { return fechaHoraSalida; }
    public void setFechaHoraSalida(LocalDateTime fechaHoraSalida) { this.fechaHoraSalida = fechaHoraSalida; }
    public LocalDateTime getFechaHoraLlegada() { return fechaHoraLlegada; }
    public void setFechaHoraLlegada(LocalDateTime fechaHoraLlegada) { this.fechaHoraLlegada = fechaHoraLlegada; }
    public Integer getCapacidad() { return capacidad; }
    public void setCapacidad(Integer capacidad) { this.capacidad = capacidad; }
    public Integer getCapacidadUsada() { return capacidadUsada; }
    public void setCapacidadUsada(Integer capacidadUsada) { this.capacidadUsada = Math.max(0, capacidadUsada != null ? capacidadUsada : 0); }
    public EstadoVueloOcurrencia getEstado() { return estado; }
    public void setEstado(EstadoVueloOcurrencia estado) { this.estado = estado; }

    public int getCapacidadDisponible() {
        return Math.max(0, (capacidad != null ? capacidad : 0) - (capacidadUsada != null ? capacidadUsada : 0));
    }

    public boolean tieneCapacidad(int bolsas) {
        return estado != EstadoVueloOcurrencia.CANCELADO && getCapacidadDisponible() >= bolsas;
    }

    public void reservar(int bolsas) {
        if (bolsas < 0 || !tieneCapacidad(bolsas)) {
            throw new IllegalStateException("No hay capacidad suficiente en la ocurrencia del vuelo.");
        }
        capacidadUsada = (capacidadUsada != null ? capacidadUsada : 0) + bolsas;
    }

    public void liberar(int bolsas) {
        capacidadUsada = Math.max(0, (capacidadUsada != null ? capacidadUsada : 0) - Math.max(0, bolsas));
    }
}
