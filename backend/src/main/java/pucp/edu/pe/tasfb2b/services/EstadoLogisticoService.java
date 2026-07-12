package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

import java.time.LocalTime;
import java.time.ZoneOffset;

@Service
public class EstadoLogisticoService {

    public int obtenerMinutoActualUtc() {
        LocalTime ahoraUtc = LocalTime.now(ZoneOffset.UTC);
        return ahoraUtc.getHour() * 60 + ahoraUtc.getMinute();
    }

    public boolean tieneRutaAsignada(SolicitudEnvio envio) {
        return envio != null && envio.getRuta() != null && !envio.getRuta().getOcurrencias().isEmpty();
    }

    public boolean estaEnvioEntregado(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (!tieneRutaAsignada(envio)) return false;
        if (contextoFinalizado) return true;
        return envio.getRuta().getOcurrencias().stream()
                .allMatch(o -> o.getEstado() == EstadoVueloOcurrencia.COMPLETADO);
    }

    public Vuelo encontrarVueloActivo(Ruta ruta, int minutoReferencia) {
        if (ruta == null) return null;
        return ruta.getOcurrencias().stream()
                .filter(o -> o.getEstado() == EstadoVueloOcurrencia.EN_VUELO)
                .map(VueloOcurrencia::getVuelo)
                .findFirst()
                .orElse(null);
    }

    public Vuelo encontrarUltimoVueloAntesDe(Ruta ruta, int minutoReferencia) {
        if (ruta == null) return null;
        Vuelo ultimo = null;
        for (VueloOcurrencia ocurrencia : ruta.getOcurrencias()) {
            if (ocurrencia.getEstado() == EstadoVueloOcurrencia.COMPLETADO) {
                ultimo = ocurrencia.getVuelo();
            }
        }
        return ultimo;
    }
}
