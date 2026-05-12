package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.ResultadoColapsoResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.ResultadoPeriodoResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class ResultadosSimulacionService {

    private static final double UMBRAL_ELEVADO = 60.0;
    private static final double UMBRAL_CRITICO = 85.0;

    private final SimulacionRepository simulacionRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;

    public ResultadosSimulacionService(
            SimulacionRepository simulacionRepository,
            SolicitudEnvioRepository solicitudEnvioRepository
    ) {
        this.simulacionRepository = simulacionRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
    }

    public ResultadoPeriodoResponse obtenerResultadoPeriodo(Integer idSimulacion) {
        Simulacion simulacion = obtenerSimulacion(idSimulacion);
        List<SolicitudEnvio> envios = solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);

        Map<String, AeropuertoStats> statsPorAeropuerto = construirStatsPorAeropuerto(envios);
        List<ResultadoPeriodoResponse.DesempenoAeropuertoResponse> desempeno = statsPorAeropuerto.values().stream()
                .map(this::mapearDesempenoAeropuerto)
                .toList();

        int totalMaletas = envios.stream().mapToInt(envio -> valor(envio.getContarBolsas())).sum();
        int totalResueltas = (int) envios.stream().filter(envio -> envio.getEstado() == EstadoEnvio.COMPLETADO).count();
        int cumplimiento = calcularPorcentaje(totalResueltas, envios.size());
        int vuelosEjecutados = envios.stream()
                .map(SolicitudEnvio::getRuta)
                .filter(ruta -> ruta != null && ruta.getVuelos() != null)
                .mapToInt(ruta -> ruta.getVuelos().size())
                .sum();
        int cancelaciones = (int) envios.stream().filter(envio -> envio.getEstado() != EstadoEnvio.COMPLETADO).count();
        int replanificaciones = (int) envios.stream()
                .map(SolicitudEnvio::getRuta)
                .filter(ruta -> ruta != null && ruta.getVuelos() != null && ruta.getVuelos().size() > 1)
                .count();

        ResultadoPeriodoResponse.ResumenOperativoResponse resumen = construirResumenOperativo(
                simulacion,
                envios,
                statsPorAeropuerto
        );

        String conclusion = cumplimiento >= 90
                ? "La simulacion mantuvo un nivel alto de cumplimiento y uso controlado de la red."
                : "La simulacion mostro cuellos de botella que requieren ajustes en capacidad y rutas.";

        String atencion = resumen.aeropuertosEnRojo() > 0
                ? "Se detectaron aeropuertos en estado critico: " + String.join(", ", resumen.icaosEnRojo()) + "."
                : null;

        return new ResultadoPeriodoResponse(
                String.valueOf(idSimulacion),
                "semanal",
                construirRango(simulacion),
                totalMaletas,
                cumplimiento,
                vuelosEjecutados,
                cancelaciones,
                replanificaciones,
                desempeno,
                resumen,
                conclusion,
                atencion
        );
    }

    public ResultadoColapsoResponse obtenerResultadoColapso(Integer idSimulacion) {
        ResultadoPeriodoResponse periodo = obtenerResultadoPeriodo(idSimulacion);

        List<ResultadoColapsoResponse.AeropuertoCriticoResponse> aeropuertosCriticos = periodo.desempenoPorAeropuerto().stream()
                .filter(a -> a.ocupacionMaxima() >= UMBRAL_ELEVADO)
                .sorted(Comparator.comparing(ResultadoPeriodoResponse.DesempenoAeropuertoResponse::ocupacionMaxima).reversed())
                .limit(5)
                .map(a -> new ResultadoColapsoResponse.AeropuertoCriticoResponse(
                        a.icao(),
                        a.nombre(),
                        a.ocupacionMaxima()
                ))
                .toList();

        if (aeropuertosCriticos.isEmpty()) {
            aeropuertosCriticos = periodo.desempenoPorAeropuerto().stream()
                    .sorted(Comparator.comparing(ResultadoPeriodoResponse.DesempenoAeropuertoResponse::ocupacionMaxima).reversed())
                    .limit(3)
                    .map(a -> new ResultadoColapsoResponse.AeropuertoCriticoResponse(
                            a.icao(),
                            a.nombre(),
                            a.ocupacionMaxima()
                    ))
                    .toList();
        }

        int plazosIncumplidos = Math.max(0, 100 - periodo.cumplimiento());
        int totalAeropuertos = Math.max(1, periodo.desempenoPorAeropuerto().size());
        int saturados = (int) periodo.desempenoPorAeropuerto().stream()
                .filter(a -> a.ocupacionMaxima() >= UMBRAL_CRITICO)
                .count();

        List<String> analisis = new ArrayList<>();
        analisis.add("La corrida mostro " + plazosIncumplidos + "% de plazos incumplidos sobre un total de "
                + periodo.totalMaletas() + " maletas procesadas.");
        analisis.add("Se observaron " + saturados + " almacenes saturados y "
                + periodo.replanificaciones() + " rutas con escalas o replanificacion.");
        analisis.add("Los aeropuertos mas exigidos fueron "
                + aeropuertosCriticos.stream().map(ResultadoColapsoResponse.AeropuertoCriticoResponse::icao).reduce((a, b) -> a + ", " + b).orElse("ninguno")
                + ".");

        return new ResultadoColapsoResponse(
                String.valueOf(idSimulacion),
                periodo.rango(),
                Math.max(1, periodo.resumen().duracionMinutos().intValue() / (24 * 60)),
                periodo.totalMaletas(),
                plazosIncumplidos,
                new ResultadoColapsoResponse.AlmacenesSaturadosResponse(
                        saturados,
                        calcularPorcentaje(saturados, totalAeropuertos)
                ),
                Math.max(1.0, Double.parseDouble(periodo.id()) > 0 ? 1.0 : 1.0),
                analisis,
                aeropuertosCriticos,
                saturados > 0
                        ? "Incrementar capacidad o repartir demanda en " + aeropuertosCriticos.getFirst().icao() + "."
                        : "Mantener monitoreo de capacidad y revisar rutas de mayor tiempo total."
        );
    }

    private Simulacion obtenerSimulacion(Integer idSimulacion) {
        return simulacionRepository.findById(idSimulacion)
                .orElseThrow(() -> new IllegalArgumentException("No existe una simulacion con id " + idSimulacion + "."));
    }

    private Map<String, AeropuertoStats> construirStatsPorAeropuerto(List<SolicitudEnvio> envios) {
        Map<String, AeropuertoStats> stats = new LinkedHashMap<>();

        for (SolicitudEnvio envio : envios) {
            registrarAeropuerto(stats, envio.getOrigen(), true, valor(envio.getContarBolsas()));
            registrarAeropuerto(stats, envio.getDestino(), false, valor(envio.getContarBolsas()));
        }

        return stats;
    }

    private void registrarAeropuerto(
            Map<String, AeropuertoStats> stats,
            Aeropuerto aeropuerto,
            boolean esSalida,
            int maletas
    ) {
        if (aeropuerto == null) {
            return;
        }

        AeropuertoStats actual = stats.computeIfAbsent(
                aeropuerto.getCodigo(),
                codigo -> new AeropuertoStats(aeropuerto)
        );

        if (esSalida) {
            actual.enviadas += maletas;
        } else {
            actual.recibidas += maletas;
        }

        double ocupacion = aeropuerto.getCapacidad() != null && aeropuerto.getCapacidad() > 0
                ? Math.min(100.0, (Math.max(actual.enviadas, actual.recibidas) * 100.0) / aeropuerto.getCapacidad())
                : 0.0;

        actual.ocupacionPromedio = Math.max(actual.ocupacionPromedio, ocupacion);
        actual.ocupacionMaxima = Math.max(actual.ocupacionMaxima, ocupacion);
    }

    private ResultadoPeriodoResponse.DesempenoAeropuertoResponse mapearDesempenoAeropuerto(AeropuertoStats stats) {
        return new ResultadoPeriodoResponse.DesempenoAeropuertoResponse(
                stats.aeropuerto.getCodigo(),
                stats.aeropuerto.getCiudad(),
                stats.recibidas,
                stats.enviadas,
                redondear(stats.ocupacionPromedio),
                redondear(stats.ocupacionMaxima),
                calcularEstadoSemaforo(stats.ocupacionMaxima)
        );
    }

    private ResultadoPeriodoResponse.ResumenOperativoResponse construirResumenOperativo(
            Simulacion simulacion,
            List<SolicitudEnvio> envios,
            Map<String, AeropuertoStats> statsPorAeropuerto
    ) {
        int maletasIntra = 0;
        int maletasInter = 0;
        double sumaIntra = 0.0;
        double sumaInter = 0.0;
        int countIntra = 0;
        int countInter = 0;

        for (SolicitudEnvio envio : envios) {
            boolean intra = envio.getOrigen() != null
                    && envio.getDestino() != null
                    && envio.getOrigen().getRegion().equalsIgnoreCase(envio.getDestino().getRegion());
            int maletas = valor(envio.getContarBolsas());
            double tiempoRuta = envio.getRuta() != null && envio.getRuta().getTiempoTotal() != null
                    ? envio.getRuta().getTiempoTotal()
                    : 0.0;

            if (intra) {
                maletasIntra += maletas;
                if (tiempoRuta > 0) {
                    sumaIntra += tiempoRuta;
                    countIntra++;
                }
            } else {
                maletasInter += maletas;
                if (tiempoRuta > 0) {
                    sumaInter += tiempoRuta;
                    countInter++;
                }
            }
        }

        List<String> icaosEnRojo = statsPorAeropuerto.values().stream()
                .filter(stats -> stats.ocupacionMaxima >= UMBRAL_CRITICO)
                .map(stats -> stats.aeropuerto.getCodigo())
                .toList();

        LocalDateTime fin = simulacion.getFechaFin() != null ? simulacion.getFechaFin() : LocalDateTime.now();
        long duracionMinutos = Math.max(1, Duration.between(simulacion.getFechaInicio(), fin).toMinutes());

        return new ResultadoPeriodoResponse.ResumenOperativoResponse(
                maletasIntra,
                maletasInter,
                redondear(countIntra == 0 ? 0.0 : sumaIntra / countIntra),
                redondear(countInter == 0 ? 0.0 : sumaInter / countInter),
                icaosEnRojo.size(),
                icaosEnRojo,
                duracionMinutos
        );
    }

    private String construirRango(Simulacion simulacion) {
        return "Simulacion " + simulacion.getIdSimulacion()
                + " (" + simulacion.getFechaInicio().toLocalDate() + ")";
    }

    private String calcularEstadoSemaforo(double ocupacion) {
        if (ocupacion >= UMBRAL_CRITICO) {
            return "critico";
        }
        if (ocupacion >= UMBRAL_ELEVADO) {
            return "elevado";
        }
        return "normal";
    }

    private int calcularPorcentaje(int numerador, int denominador) {
        if (denominador <= 0) {
            return 0;
        }
        return (int) Math.round((numerador * 100.0) / denominador);
    }

    private int valor(Integer numero) {
        return numero != null ? numero : 0;
    }

    private double redondear(double valor) {
        return Math.round(valor * 100.0) / 100.0;
    }

    private static class AeropuertoStats {
        private final Aeropuerto aeropuerto;
        private int recibidas;
        private int enviadas;
        private double ocupacionPromedio;
        private double ocupacionMaxima;

        private AeropuertoStats(Aeropuerto aeropuerto) {
            this.aeropuerto = aeropuerto;
        }
    }
}
