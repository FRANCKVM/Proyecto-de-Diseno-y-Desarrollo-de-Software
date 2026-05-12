package pucp.edu.pe.tasfb2b.controllers.dto;

public record EstadoOperacionResponse(
        String fechaActual,
        Integer enviosHoy,
        Integer enTransito,
        Integer entregadas,
        Integer cumplimiento
) {
}
