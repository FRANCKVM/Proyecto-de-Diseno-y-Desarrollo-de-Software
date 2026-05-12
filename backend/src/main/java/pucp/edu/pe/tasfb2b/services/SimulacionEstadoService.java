package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;

import java.util.List;

@Service
public class SimulacionEstadoService {

    public EstadoSimulacion construirEstado(
            Integer idSimulacion,
            boolean simulacionActiva,
            boolean procesandoBloque,
            Integer kActual,
            Integer saMinutos,
            Integer scMinutos,
            Integer punteroConsumoMinutos,
            Integer ultimoMinutoSimulacion,
            int indiceSiguienteSolicitud,
            List<SolicitudEnvio> solicitudesPendientes,
            SimulacionMetricas metricas
    ) {
        double tiempoPlanificacionTotalSeg = metricas.getTiempoPlanificacionTotalNs() / 1_000_000_000.0;

        double tiempoPromedioPorSolicitudMs = metricas.getTotalConsumidas() == 0
                ? 0.0
                : metricas.getTiempoPlanificacionTotalNs() / 1_000_000.0 / metricas.getTotalConsumidas();

        double porcentajeResueltas = metricas.getTotalConsumidas() == 0
                ? 0.0
                : ((double) metricas.getResueltas() / metricas.getTotalConsumidas()) * 100.0;

        double costoPromedioRutas = metricas.getResueltas() == 0
                ? 0.0
                : metricas.getCostoTotalRutas() / metricas.getResueltas();

        double promedioVuelos = metricas.getResueltas() == 0
                ? 0.0
                : (double) metricas.getTotalVuelosUsados() / metricas.getResueltas();

        double promedioEscalas = metricas.getResueltas() == 0
                ? 0.0
                : (double) metricas.getTotalEscalas() / metricas.getResueltas();

        double porcentajeDirectas = metricas.getResueltas() == 0
                ? 0.0
                : (double) metricas.getRutasDirectas() * 100.0 / metricas.getResueltas();

        double porcentajeConParada = metricas.getResueltas() == 0
                ? 0.0
                : (double) metricas.getRutasConParada() * 100.0 / metricas.getResueltas();

        double penalizacionEscalas = promedioEscalas * 2.0;
        double penalizacionTiempo = tiempoPlanificacionTotalSeg * 0.05;

        double fitnessGlobal = porcentajeResueltas - penalizacionEscalas - penalizacionTiempo;
        fitnessGlobal = Math.max(0.0, Math.min(100.0, fitnessGlobal));

        int totalSolicitudesCargadas = solicitudesPendientes == null
                ? 0
                : solicitudesPendientes.size();

        return new EstadoSimulacion(
                idSimulacion,
                simulacionActiva,
                procesandoBloque,
                kActual,
                saMinutos,
                scMinutos,
                punteroConsumoMinutos,
                ultimoMinutoSimulacion,
                indiceSiguienteSolicitud,
                totalSolicitudesCargadas,
                metricas.getBloquesProcesados(),
                metricas.getTotalConsumidas(),
                metricas.getResueltas(),
                metricas.getNoResueltas(),
                metricas.getNoResueltasPorAlmacenOrigen(),
                metricas.getNoResueltasPorRutaVueloPlazo(),
                metricas.getRutasDirectas(),
                metricas.getRutasConParada(),
                metricas.getTotalVuelosUsados(),
                metricas.getTotalEscalas(),
                promedioVuelos,
                promedioEscalas,
                porcentajeDirectas,
                porcentajeConParada,
                costoPromedioRutas,
                porcentajeResueltas,
                tiempoPlanificacionTotalSeg,
                tiempoPromedioPorSolicitudMs,
                fitnessGlobal
        );
    }
}
