package pucp.edu.pe.tasfb2b.entities;

import java.time.LocalDateTime;

public class VueloCancelacion {

    private Integer idCancelacion;

    private Vuelo vuelo;

    private LocalDateTime fechaHoraSalida;

    private LocalDateTime fechaHoraCancelacion;

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
