package pucp.edu.pe.tasfb2b.controllers.dto;

import java.util.List;

public record EnvioDetalleResponse(
        String codigo,
        String estado,
        String aerolinea,
        String origenIcao,
        String destinoIcao,
        String tipo,
        Double plazoMaximoDias,
        String fechaRegistro,
        Integer cantidadMaletas,
        List<HitoRutaResponse> ruta,
        List<BloquePaquetesResponse> paquetes,
        String tiempoRestante,
        Boolean dentroDePlazo
) {
    public record HitoRutaResponse(
            String tipo,
            String aeropuertoIcao,
            String fecha,
            String vueloCodigo,
            String estado
    ) {
    }

    public record BloquePaquetesResponse(
            String codigoInicial,
            String codigoFinal,
            Integer cantidad,
            String estado
    ) {
    }
}
