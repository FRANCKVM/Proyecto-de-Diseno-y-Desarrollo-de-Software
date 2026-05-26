package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;

import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;

@Service
public class EstadoLogisticoService {

    public int obtenerMinutoActualUtc() {
        LocalTime ahoraUtc = LocalTime.now(ZoneOffset.UTC);
        return ahoraUtc.getHour() * 60 + ahoraUtc.getMinute();
    }

    public boolean tieneRutaAsignada(SolicitudEnvio envio) {
        return envio != null
                && envio.getRuta() != null
                && envio.getRuta().getVuelos() != null
                && !envio.getRuta().getVuelos().isEmpty();
    }

    public Integer obtenerPrimeraSalidaUtc(Ruta ruta) {
        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return null;
        }

        return ruta.getVuelos().stream()
                .map(Vuelo::getSalidaUtcMin)
                .filter(minuto -> minuto != null)
                .min(Comparator.naturalOrder())
                .orElse(null);
    }

    public Integer obtenerUltimaLlegadaUtc(Ruta ruta) {
        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return null;
        }

        return ruta.getVuelos().stream()
                .map(Vuelo::getLlegadaUtcMin)
                .filter(minuto -> minuto != null)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    public boolean estaEnvioEntregado(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (!tieneRutaAsignada(envio)) {
            return false;
        }

        if (contextoFinalizado) {
            return true;
        }

        Integer ultimaLlegada = obtenerUltimaLlegadaUtc(envio.getRuta());
        return minutoReferencia != null
                && ultimaLlegada != null
                && minutoReferencia >= ultimaLlegada;
    }

    public String determinarEstadoVuelo(
            Vuelo vuelo,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (vuelo == null) {
            return "programado";
        }

        if (vuelo.estaCancelado()) {
            return "cancelado";
        }

        if (contextoFinalizado) {
            return "completado";
        }

        int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salida;

        if (minutoReferencia == null) {
            return "programado";
        }

        if (minutoReferencia >= llegada) {
            return "completado";
        }

        if (minutoReferencia >= salida) {
            return "en_vuelo";
        }

        return "programado";
    }

    public Vuelo encontrarVueloActivo(Ruta ruta, int minutoReferencia) {
        if (ruta == null || ruta.getVuelos() == null) {
            return null;
        }

        return ruta.getVuelos().stream()
                .filter(vuelo -> {
                    int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
                    int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salida;
                    return minutoReferencia >= salida && minutoReferencia < llegada;
                })
                .findFirst()
                .orElse(null);
    }

    public Vuelo encontrarSiguienteVuelo(Ruta ruta, int minutoReferencia) {
        if (ruta == null || ruta.getVuelos() == null) {
            return null;
        }

        return ruta.getVuelos().stream()
                .filter(vuelo -> {
                    int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
                    return minutoReferencia < salida;
                })
                .findFirst()
                .orElse(null);
    }

    public Vuelo encontrarUltimoVueloAntesDe(Ruta ruta, int minutoReferencia) {
        if (ruta == null || ruta.getVuelos() == null) {
            return null;
        }

        List<Vuelo> vuelos = ruta.getVuelos();
        Vuelo ultimo = null;

        for (Vuelo vuelo : vuelos) {
            int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : 0;
            if (minutoReferencia >= llegada) {
                ultimo = vuelo;
            }
        }

        return ultimo;
    }
}
