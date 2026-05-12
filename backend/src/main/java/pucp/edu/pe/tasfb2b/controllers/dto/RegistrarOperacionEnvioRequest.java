package pucp.edu.pe.tasfb2b.controllers.dto;

public record RegistrarOperacionEnvioRequest(
        String origenIcao,
        String destinoIcao,
        Integer contarBolsas
) {
}
