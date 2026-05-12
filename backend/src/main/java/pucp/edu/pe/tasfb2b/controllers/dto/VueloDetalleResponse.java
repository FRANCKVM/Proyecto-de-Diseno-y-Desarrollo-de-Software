package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record VueloDetalleResponse(
        String codigo,
        String estado,
        String tipo,
        Integer capacidad,
        Integer ocupacion,
        String origenIcao,
        String destinoIcao,
        String fechaSalida,
        String fechaLlegadaEstimada,
        List<EnvioEnVueloResponse> envios
) {
    public record EnvioEnVueloResponse(
            String codigo,
            String origenIcao,
            String destinoIcao,
            Integer maletasOcupadas,
            Integer maletasTotales
    ) {
    }
}
