package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.HistorialSimulacionResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.ResultadoColapsoResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.ResultadoPeriodoResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.AsignacionEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
@Transactional(readOnly = true)
public class ResultadosSimulacionService {

    private static final double UMBRAL_ELEVADO = 60.0;
    private static final double UMBRAL_CRITICO = 85.0;

    private final SimulacionRepository simulacionRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final AsignacionEnvioRepository asignacionEnvioRepository;

    public ResultadosSimulacionService(
            SimulacionRepository simulacionRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            AsignacionEnvioRepository asignacionEnvioRepository
    ) {
        this.simulacionRepository = simulacionRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.asignacionEnvioRepository = asignacionEnvioRepository;
    }

    public ResultadoPeriodoResponse obtenerResultadoPeriodo(Integer idSimulacion) {
        Simulacion simulacion = obtenerSimulacion(idSimulacion);
        List<SolicitudEnvio> envios = solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);
        return construirResultadoPeriodo(simulacion, envios, agruparAsignacionesPorEnvio(envios));
    }

    private ResultadoPeriodoResponse construirResultadoPeriodo(
            Simulacion simulacion,
            List<SolicitudEnvio> envios,
            Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio
    ) {
        Map<String, AeropuertoStats> statsPorAeropuerto = construirStatsPorAeropuerto(
                simulacion,
                envios,
                asignacionesPorEnvio
        );
        List<ResultadoPeriodoResponse.DesempenoAeropuertoResponse> desempeno = statsPorAeropuerto.values().stream()
                .map(this::mapearDesempenoAeropuerto)
                .toList();

        int totalMaletas = envios.stream().mapToInt(envio -> valor(envio.getContarBolsas())).sum();
        int totalDentroDePlazo = (int) envios.stream()
                .filter(envio -> cumplePlazoComprometido(
                        envio,
                        obtenerRutasAsignadas(envio, asignacionesPorEnvio)
                ))
                .count();
        int cumplimiento = calcularPorcentaje(totalDentroDePlazo, envios.size());
        int vuelosEjecutados = envios.stream()
                .flatMap(envio -> obtenerRutasAsignadas(envio, asignacionesPorEnvio).stream())
                .map(RutaAsignada::ruta)
                .filter(ruta -> ruta != null && ruta.getVuelos() != null)
                .mapToInt(ruta -> ruta.getVuelos().size())
                .sum();
        int cancelaciones = valor(simulacion.getCancelacionesVuelos());
        int replanificaciones = (int) envios.stream()
                .flatMap(envio -> obtenerRutasAsignadas(envio, asignacionesPorEnvio).stream())
                .map(RutaAsignada::ruta)
                .filter(ruta -> ruta != null && ruta.getVuelos() != null && ruta.getVuelos().size() > 1)
                .count();

        ResultadoPeriodoResponse.ResumenOperativoResponse resumen = construirResumenOperativo(
                simulacion,
                envios,
                statsPorAeropuerto,
                asignacionesPorEnvio
        );

        String conclusion = cumplimiento >= 90
                ? "La simulacion mantuvo un nivel alto de cumplimiento y uso controlado de la red."
                : "La simulacion mostro cuellos de botella que requieren ajustes en capacidad y rutas.";

        String atencion = resumen.aeropuertosEnRojo() > 0
                ? "Se detectaron aeropuertos en estado critico: " + String.join(", ", resumen.icaosEnRojo()) + "."
                : null;

        return new ResultadoPeriodoResponse(
                String.valueOf(simulacion.getIdSimulacion()),
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
        Simulacion simulacion = obtenerSimulacion(idSimulacion);
        List<SolicitudEnvio> envios = solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);
        ResultadoPeriodoResponse periodo = construirResultadoPeriodo(simulacion, envios, agruparAsignacionesPorEnvio(envios));
        return construirResultadoColapso(periodo);
    }

    private ResultadoColapsoResponse construirResultadoColapso(ResultadoPeriodoResponse periodo) {
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
                periodo.id(),
                periodo.rango(),
                Math.max(1, (int) Math.ceil(periodo.resumen().duracionMinutos() / (double) (24 * 60))),
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

    public List<HistorialSimulacionResponse> listarHistorialSimulaciones() {
        Map<Integer, List<SolicitudEnvio>> enviosPorSimulacion = agruparEnviosPorSimulacion();

        return simulacionRepository.findAll().stream()
                .sorted(Comparator.comparing(
                        Simulacion::getFechaInicio,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ).reversed())
                .map(simulacion -> mapearHistorialSimulacion(
                        simulacion,
                        enviosPorSimulacion.getOrDefault(simulacion.getIdSimulacion(), List.of())
                ))
                .toList();
    }

    private Simulacion obtenerSimulacion(Integer idSimulacion) {
        return simulacionRepository.findById(idSimulacion)
                .orElseThrow(() -> new IllegalArgumentException("No existe una simulacion con id " + idSimulacion + "."));
    }

    private Map<Integer, List<SolicitudEnvio>> agruparEnviosPorSimulacion() {
        Map<Integer, List<SolicitudEnvio>> enviosPorSimulacion = new HashMap<>();

        for (SolicitudEnvio envio : solicitudEnvioRepository.findAllConRelacionesDeSimulacion()) {
            Integer idSimulacion = envio.getIdSimulacion();
            if (idSimulacion == null) {
                continue;
            }

            enviosPorSimulacion.computeIfAbsent(idSimulacion, ignored -> new ArrayList<>())
                    .add(envio);
        }

        return enviosPorSimulacion;
    }

    private Map<Integer, List<AsignacionEnvio>> agruparAsignacionesPorEnvio(List<SolicitudEnvio> envios) {
        Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio = new HashMap<>();

        if (envios == null || envios.isEmpty()) {
            return asignacionesPorEnvio;
        }

        for (AsignacionEnvio asignacion : asignacionEnvioRepository
                .findByEnvioInOrderByEnvio_IdEnvioAscIdAsignacionAsc(envios)) {
            if (asignacion.getEnvio() == null || asignacion.getEnvio().getIdEnvio() == null) {
                continue;
            }

            asignacionesPorEnvio
                    .computeIfAbsent(asignacion.getEnvio().getIdEnvio(), ignored -> new ArrayList<>())
                    .add(asignacion);
        }

        return asignacionesPorEnvio;
    }

    private List<RutaAsignada> obtenerRutasAsignadas(
            SolicitudEnvio envio,
            Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio
    ) {
        if (envio == null) {
            return List.of();
        }

        List<AsignacionEnvio> asignaciones = asignacionesPorEnvio.getOrDefault(
                envio.getIdEnvio(),
                List.of()
        );

        if (!asignaciones.isEmpty()) {
            return asignaciones.stream()
                    .filter(asignacion -> asignacion.getRuta() != null)
                    .map(asignacion -> new RutaAsignada(
                            asignacion.getRuta(),
                            valor(asignacion.getCantidadBolsas())
                    ))
                    .toList();
        }

        if (envio.getRuta() == null) {
            return List.of();
        }

        return List.of(new RutaAsignada(envio.getRuta(), valor(envio.getContarBolsas())));
    }

    private HistorialSimulacionResponse mapearHistorialSimulacion(
            Simulacion simulacion,
            List<SolicitudEnvio> envios
    ) {
        String tipo = inferirTipo(simulacion);
        ResultadoPeriodoResponse periodo = construirResultadoPeriodo(simulacion, envios, agruparAsignacionesPorEnvio(envios));

        if ("colapso".equals(tipo)) {
            ResultadoColapsoResponse colapso = construirResultadoColapso(periodo);
            return new HistorialSimulacionResponse(
                    simulacion.getIdSimulacion(),
                    tipo,
                    simulacion.getK(),
                    simulacion.getActiva(),
                    simulacion.getFechaInicio(),
                    simulacion.getFechaFin(),
                    colapso.rango(),
                    colapso.maletasProcesadas(),
                    null,
                    periodo.vuelosEjecutados(),
                    periodo.cancelaciones(),
                    periodo.replanificaciones(),
                    colapso.diasHastaColapso(),
                    colapso.plazosIncumplidos(),
                    colapso.almacenesSaturados().cantidad(),
                    colapso.sugerencia()
            );
        }

        return new HistorialSimulacionResponse(
                simulacion.getIdSimulacion(),
                tipo,
                simulacion.getK(),
                simulacion.getActiva(),
                simulacion.getFechaInicio(),
                simulacion.getFechaFin(),
                periodo.rango(),
                periodo.totalMaletas(),
                periodo.cumplimiento(),
                periodo.vuelosEjecutados(),
                periodo.cancelaciones(),
                periodo.replanificaciones(),
                null,
                null,
                null,
                periodo.conclusion()
        );
    }

    private Map<String, AeropuertoStats> construirStatsPorAeropuerto(
            Simulacion simulacion,
            List<SolicitudEnvio> envios,
            Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio
    ) {
        Map<String, AeropuertoStats> stats = new LinkedHashMap<>();

        for (SolicitudEnvio envio : envios) {
            registrarAeropuerto(stats, envio.getOrigen(), true, valor(envio.getContarBolsas()));
            registrarAeropuerto(stats, envio.getDestino(), false, valor(envio.getContarBolsas()));
            registrarOcupacionAlmacen(
                    stats,
                    simulacion,
                    envio,
                    obtenerRutasAsignadas(envio, asignacionesPorEnvio)
            );
        }

        long horizonteMinutos = calcularHorizonteOcupacion(stats);
        for (AeropuertoStats statsAeropuerto : stats.values()) {
            calcularOcupacionAlmacen(statsAeropuerto, horizonteMinutos);
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
    }

    private void registrarOcupacionAlmacen(
            Map<String, AeropuertoStats> stats,
            Simulacion simulacion,
            SolicitudEnvio envio,
            List<RutaAsignada> rutasAsignadas
    ) {
        if (simulacion == null || envio == null || rutasAsignadas.isEmpty()) {
            return;
        }

        int minutoSolicitud = calcularMinutoSimulacion(simulacion, envio);

        for (RutaAsignada rutaAsignada : rutasAsignadas) {
            if (rutaAsignada.ruta() == null || rutaAsignada.ruta().getVuelos() == null) {
                continue;
            }

            List<VentanaVuelo> ventanas = calcularVentanasRuta(
                    rutaAsignada.ruta(),
                    minutoSolicitud
            );

            if (ventanas.isEmpty()) {
                continue;
            }

            int maletas = rutaAsignada.maletas();
            registrarReservaAlmacen(stats, envio.getOrigen(), minutoSolicitud, ventanas.getFirst().salidaMinuto(), maletas);

            for (int i = 0; i < ventanas.size() - 1; i++) {
                VentanaVuelo llegada = ventanas.get(i);
                VentanaVuelo siguienteSalida = ventanas.get(i + 1);
                registrarReservaAlmacen(stats, llegada.vuelo().getHasta(), llegada.llegadaMinuto(), siguienteSalida.salidaMinuto(), maletas);
            }
        }
    }

    private List<VentanaVuelo> calcularVentanasRuta(Ruta ruta, int minutoInicio) {
        List<VentanaVuelo> ventanas = new ArrayList<>();
        int minutoReferencia = Math.max(0, minutoInicio);

        for (Vuelo vuelo : ruta.getVuelos()) {
            int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
            int llegadaBase = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salidaBase;

            while (llegadaBase <= salidaBase) {
                llegadaBase += 24 * 60;
            }

            int diaReferencia = Math.floorDiv(minutoReferencia, 24 * 60);
            int salida = salidaBase + diaReferencia * 24 * 60;
            int llegada = llegadaBase + diaReferencia * 24 * 60;

            while (salida < minutoReferencia) {
                salida += 24 * 60;
                llegada += 24 * 60;
            }

            ventanas.add(new VentanaVuelo(vuelo, salida, llegada));
            minutoReferencia = llegada;
        }

        return ventanas;
    }

    private int calcularMinutoSimulacion(Simulacion simulacion, SolicitudEnvio envio) {
        LocalDateTime inicio = simulacion.getFechaInicio();
        LocalDateTime registro = envio.getFechaHoraRegistro();

        if (inicio == null || registro == null) {
            return 0;
        }

        return Math.max(0, (int) Duration.between(inicio, registro).toMinutes());
    }

    private void registrarReservaAlmacen(
            Map<String, AeropuertoStats> stats,
            Aeropuerto aeropuerto,
            int inicioMinuto,
            int finMinuto,
            int maletas
    ) {
        if (aeropuerto == null || maletas <= 0 || finMinuto <= inicioMinuto) {
            return;
        }

        AeropuertoStats actual = stats.computeIfAbsent(
                aeropuerto.getCodigo(),
                codigo -> new AeropuertoStats(aeropuerto)
        );
        actual.eventosOcupacion.add(new EventoOcupacion(inicioMinuto, maletas));
        actual.eventosOcupacion.add(new EventoOcupacion(finMinuto, -maletas));
    }

    private long calcularHorizonteOcupacion(Map<String, AeropuertoStats> stats) {
        return stats.values().stream()
                .flatMap(statsAeropuerto -> statsAeropuerto.eventosOcupacion.stream())
                .mapToInt(EventoOcupacion::minuto)
                .max()
                .stream()
                .asLongStream()
                .max()
                .orElse(1L);
    }

    private void calcularOcupacionAlmacen(AeropuertoStats stats, long horizonteMinutos) {
        Integer capacidad = stats.aeropuerto.getCapacidad();
        if (capacidad == null || capacidad <= 0 || stats.eventosOcupacion.isEmpty()) {
            stats.ocupacionPromedio = 0.0;
            stats.ocupacionMaxima = 0.0;
            return;
        }

        Map<Integer, Integer> eventosPorMinuto = new TreeMap<>();
        for (EventoOcupacion evento : stats.eventosOcupacion) {
            eventosPorMinuto.merge(
                    Math.max(0, evento.minuto()),
                    evento.deltaMaletas(),
                    Integer::sum
            );
        }

        long areaOcupada = 0;
        int ocupacionActual = 0;
        int ocupacionMaxima = 0;
        int minutoAnterior = 0;

        for (Map.Entry<Integer, Integer> evento : eventosPorMinuto.entrySet()) {
            int minutoEvento = evento.getKey();
            if (minutoEvento > minutoAnterior) {
                areaOcupada += (long) ocupacionActual * (minutoEvento - minutoAnterior);
                minutoAnterior = minutoEvento;
            }

            ocupacionActual = Math.max(0, ocupacionActual + evento.getValue());
            ocupacionMaxima = Math.max(ocupacionMaxima, ocupacionActual);
        }

        stats.ocupacionPromedio = Math.min(100.0, (areaOcupada * 100.0) / (capacidad * Math.max(1L, horizonteMinutos)));
        stats.ocupacionMaxima = Math.min(100.0, (ocupacionMaxima * 100.0) / capacidad);
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
            Map<String, AeropuertoStats> statsPorAeropuerto,
            Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio
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
            List<RutaAsignada> rutasAsignadas = obtenerRutasAsignadas(envio, asignacionesPorEnvio);
            double tiempoRuta = calcularTiempoPromedioRutasAsignadas(rutasAsignadas);

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

        long duracionMinutos = calcularDuracionSimuladaMinutos(
                simulacion,
                envios,
                asignacionesPorEnvio
        );

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

    private double calcularTiempoPromedioRutasAsignadas(List<RutaAsignada> rutasAsignadas) {
        if (rutasAsignadas == null || rutasAsignadas.isEmpty()) {
            return 0.0;
        }

        int totalMaletas = 0;
        double sumaPonderada = 0.0;

        for (RutaAsignada rutaAsignada : rutasAsignadas) {
            if (rutaAsignada.ruta() == null || rutaAsignada.ruta().getTiempoTotal() == null) {
                continue;
            }

            int maletas = Math.max(1, rutaAsignada.maletas());
            totalMaletas += maletas;
            sumaPonderada += rutaAsignada.ruta().getTiempoTotal() * maletas;
        }

        return totalMaletas == 0 ? 0.0 : sumaPonderada / totalMaletas;
    }

    private long calcularDuracionSimuladaMinutos(
            Simulacion simulacion,
            List<SolicitudEnvio> envios,
            Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio
    ) {
        if (simulacion.getDuracionSimulacionMinutos() != null
                && simulacion.getDuracionSimulacionMinutos() > 0) {
            return simulacion.getDuracionSimulacionMinutos();
        }

        long maxMinuto = 0;
        for (SolicitudEnvio envio : envios) {
            int minutoSolicitud = calcularMinutoSimulacion(simulacion, envio);
            maxMinuto = Math.max(maxMinuto, minutoSolicitud);

            for (RutaAsignada rutaAsignada : obtenerRutasAsignadas(envio, asignacionesPorEnvio)) {
                if (rutaAsignada.ruta() == null || rutaAsignada.ruta().getVuelos() == null) {
                    continue;
                }

                List<VentanaVuelo> ventanas = calcularVentanasRuta(rutaAsignada.ruta(), minutoSolicitud);
                if (!ventanas.isEmpty()) {
                    maxMinuto = Math.max(maxMinuto, ventanas.getLast().llegadaMinuto());
                }
            }
        }

        if (maxMinuto <= 0 && simulacion.getFechaInicio() != null && simulacion.getFechaFin() != null) {
            maxMinuto = Duration.between(simulacion.getFechaInicio(), simulacion.getFechaFin()).toMinutes();
        }

        return Math.max(1, maxMinuto);
    }

    private String construirRango(Simulacion simulacion) {
        return "Simulacion " + simulacion.getIdSimulacion()
                + " (" + simulacion.getFechaInicio().toLocalDate() + ")";
    }

    private String inferirTipo(Simulacion simulacion) {
        return simulacion.getK() != null && simulacion.getK() >= 30
                ? "colapso"
                : "semanal";
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

    private boolean cumplePlazoComprometido(SolicitudEnvio envio, List<RutaAsignada> rutasAsignadas) {
        if (envio == null || rutasAsignadas == null || rutasAsignadas.isEmpty()) {
            return false;
        }

        Double plazoMaximo = envio.getDiasTiempoMaximo();
        if (plazoMaximo == null) {
            return false;
        }

        return rutasAsignadas.stream()
                .map(RutaAsignada::ruta)
                .allMatch(ruta -> ruta != null
                        && ruta.getTiempoTotal() != null
                        && ruta.getTiempoTotal() <= plazoMaximo);
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
        private final List<EventoOcupacion> eventosOcupacion = new ArrayList<>();

        private AeropuertoStats(Aeropuerto aeropuerto) {
            this.aeropuerto = aeropuerto;
        }
    }

    private record VentanaVuelo(
            Vuelo vuelo,
            int salidaMinuto,
            int llegadaMinuto
    ) {
    }

    private record RutaAsignada(
            Ruta ruta,
            int maletas
    ) {
    }

    private record EventoOcupacion(
            int minuto,
            int deltaMaletas
    ) {
    }
}
