package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record CargaEnviosOperacionResponse(
        int totalLineas,
        int enviosRegistrados,
        int lineasOmitidas,
        List<String> errores
) {
}
