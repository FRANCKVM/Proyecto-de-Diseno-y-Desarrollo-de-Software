package pucp.edu.pe.tasfb2b.entities;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "vuelo_cancelacion",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_vuelo_cancelacion_ocurrencia",
                columnNames = {"id_vuelo", "fecha_hora_salida"}
        )
)
public class VueloCancelacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cancelacion")
    private Integer idCancelacion;

    @ManyToOne(optional = false)
    @JoinColumn(name = "id_vuelo", nullable = false)
    private Vuelo vuelo;

    @Column(name = "fecha_hora_salida", nullable = false)
    private LocalDateTime fechaHoraSalida;

    @Column(name = "fecha_hora_cancelacion", nullable = false)
    private LocalDateTime fechaHoraCancelacion;

    @Column(name = "fecha_hora_creacion", nullable = false)
    private LocalDateTime fechaHoraCreacion;

    public VueloCancelacion() {
    }

    public VueloCancelacion(
            Vuelo vuelo,
            LocalDateTime fechaHoraSalida,
            LocalDateTime fechaHoraCancelacion,
            LocalDateTime fechaHoraCreacion
    ) {
        this.vuelo = vuelo;
        this.fechaHoraSalida = fechaHoraSalida;
        this.fechaHoraCancelacion = fechaHoraCancelacion;
        this.fechaHoraCreacion = fechaHoraCreacion;
    }

    public Integer getIdCancelacion() {
        return idCancelacion;
    }

    public void setIdCancelacion(Integer idCancelacion) {
        this.idCancelacion = idCancelacion;
    }

    public Vuelo getVuelo() {
        return vuelo;
    }

    public void setVuelo(Vuelo vuelo) {
        this.vuelo = vuelo;
    }

    public LocalDateTime getFechaHoraSalida() {
        return fechaHoraSalida;
    }

    public void setFechaHoraSalida(LocalDateTime fechaHoraSalida) {
        this.fechaHoraSalida = fechaHoraSalida;
    }

    public LocalDateTime getFechaHoraCancelacion() {
        return fechaHoraCancelacion;
    }

    public void setFechaHoraCancelacion(LocalDateTime fechaHoraCancelacion) {
        this.fechaHoraCancelacion = fechaHoraCancelacion;
    }

    public LocalDateTime getFechaHoraCreacion() {
        return fechaHoraCreacion;
    }

    public void setFechaHoraCreacion(LocalDateTime fechaHoraCreacion) {
        this.fechaHoraCreacion = fechaHoraCreacion;
    }
}
