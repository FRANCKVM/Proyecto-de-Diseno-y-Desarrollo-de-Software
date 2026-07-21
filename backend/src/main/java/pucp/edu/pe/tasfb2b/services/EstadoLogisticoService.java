package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
public class EstadoLogisticoService {

    public static final int MINUTOS_ENTRE_COMPLETADO_Y_ENTREGADO = 15;

    public int obtenerMinutoActualUtc() {
        LocalTime ahoraUtc = LocalTime.now(ZoneOffset.UTC);
        return ahoraUtc.getHour() * 60 + ahoraUtc.getMinute();
    }

    public boolean tieneRutaAsignada(SolicitudEnvio envio) {
        return !obtenerRutasAsignadas(envio).isEmpty();
    }

    public EstadoEnvio resolverEstadoEnvio(
            SolicitudEnvio envio,
            LocalDateTime referencia,
            boolean contextoFinalizado
    ) {
        List<Ruta> rutas = obtenerRutasAsignadas(envio);
        if (envio == null || rutas.isEmpty()) {
            return EstadoEnvio.REGISTRADO;
        }

        LocalDateTime fechaReferencia = referencia != null
                ? referencia
                : LocalDateTime.now(ZoneOffset.UTC);
        TimelineEnvio timeline = obtenerTimeline(rutas);

        if (timeline.ultimaLlegada() == null) {
            return EstadoEnvio.PLANIFICADO;
        }

        if (!fechaReferencia.isBefore(timeline.ultimaLlegada()
                .plusMinutes(MINUTOS_ENTRE_COMPLETADO_Y_ENTREGADO))) {
            return EstadoEnvio.ENTREGADO;
        }

        if (!fechaReferencia.isBefore(timeline.ultimaLlegada())) {
            return EstadoEnvio.COMPLETADO;
        }

        if (timeline.primeraSalida() != null
                && !fechaReferencia.isBefore(timeline.primeraSalida())) {
            return EstadoEnvio.EN_TRANSITO;
        }

        return EstadoEnvio.PLANIFICADO;
    }

    public boolean estaEnvioEntregado(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        return resolverEstadoEnvio(
                envio,
                resolverReferenciaDesdeMinuto(envio, minutoReferencia),
                contextoFinalizado
        ) == EstadoEnvio.ENTREGADO;
    }

    public boolean estaEnvioCompletado(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        EstadoEnvio estado = resolverEstadoEnvio(
                envio,
                resolverReferenciaDesdeMinuto(envio, minutoReferencia),
                contextoFinalizado
        );
        return estado == EstadoEnvio.COMPLETADO || estado == EstadoEnvio.ENTREGADO;
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

    private List<Ruta> obtenerRutasAsignadas(SolicitudEnvio envio) {
        List<Ruta> rutas = new ArrayList<>();
        if (envio == null) {
            return rutas;
        }

        for (SolicitudEnvio.AsignacionEnvioVista asignacion : envio.getAsignaciones()) {
            Ruta ruta = asignacion.getRuta();
            if (ruta != null && ruta.getOcurrencias() != null && !ruta.getOcurrencias().isEmpty()) {
                rutas.add(ruta);
            }
        }

        if (!rutas.isEmpty()) {
            return rutas;
        }

        Ruta ruta = envio.getRuta();
        if (ruta != null && ruta.getOcurrencias() != null && !ruta.getOcurrencias().isEmpty()) {
            rutas.add(ruta);
        }

        return rutas;
    }

    private TimelineEnvio obtenerTimeline(List<Ruta> rutas) {
        LocalDateTime primeraSalida = null;
        LocalDateTime ultimaLlegada = null;

        for (Ruta ruta : rutas) {
            for (VueloOcurrencia ocurrencia : ruta.getOcurrencias()) {
                LocalDateTime salida = ocurrencia.getFechaHoraSalida();
                LocalDateTime llegada = ocurrencia.getFechaHoraLlegada();
                if (salida != null) {
                    primeraSalida = primeraSalida == null || salida.isBefore(primeraSalida)
                            ? salida
                            : primeraSalida;
                }
                if (llegada != null) {
                    ultimaLlegada = ultimaLlegada == null || llegada.isAfter(ultimaLlegada)
                            ? llegada
                            : ultimaLlegada;
                }
            }
        }

        return new TimelineEnvio(primeraSalida, ultimaLlegada);
    }

    private LocalDateTime resolverReferenciaDesdeMinuto(
            SolicitudEnvio envio,
            Integer minutoReferencia
    ) {
        if (minutoReferencia == null) {
            return LocalDateTime.now(ZoneOffset.UTC);
        }

        LocalDate fecha = envio != null && envio.getFecha() != null
                ? envio.getFecha()
                : LocalDate.now(ZoneOffset.UTC);
        return fecha.atStartOfDay().plusMinutes(Math.max(0, minutoReferencia));
    }

    private record TimelineEnvio(LocalDateTime primeraSalida, LocalDateTime ultimaLlegada) {
    }
}
