package pucp.edu.pe.tasfb2b.controllers.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record InicioSimulacionRequest(
        Integer k,
        LocalDate fechaInicio,
        LocalTime horaInicio,
        Integer duracionDias
) {
}
