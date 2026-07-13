package pucp.edu.pe.tasfb2b.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.algorithms.ga.PlanificadorGenetico;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
public class SimulacionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SimulacionService.class);

    private static final int SA_MINUTOS = 5;// bloque en minutos debe multiplicarse por k
    private static final int DURACION_SEMANAL_DIAS = 5;
    private static final long INTERVALO_VERIFICACION_MS = 1000;
    private static final long INTERVALO_REAL_SEMANAL_MS = 40000;
    private static final long INTERVALO_REAL_COLAPSO_MS = 75000;
    private static final int VENTANA_CANCELACIONES_MAPA_MIN = 60;

    private static final int TAMANO_POBLACION = 30;
    private static final int GENERACIONES = 60;
    private static final double TASA_CRUZAMIENTO = 0.85;
    private static final double TASA_MUTACION = 0.25;
    private static final int TAMANO_TORNEO = 3;
    private static final int ESCALAS_INTERMEDIAS_MAX = 4;
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final SimulacionCargaService simulacionCargaService;
    private final SimulacionEstadoService simulacionEstadoService;
    private final AeropuertoRepository aeropuertoRepository;
    private final SimulacionRepository simulacionRepository;
    private final VueloRepository vueloRepository;
    private final VueloCancelacionService vueloCancelacionService;
    private final VueloOcurrenciaService vueloOcurrenciaService;
    private final ResultadosSimulacionService resultadosSimulacionService;
    private final ObjectMapper objectMapper;
    private final SimulationSseService simulationSseService;

    private boolean simulacionActiva = false;
    private boolean procesandoBloque = false;

    private Integer kActual;
    private Integer scMinutos;
    private Long intervaloRealActualMs;
    private Long ultimaEjecucionBloqueRealMs;
    private Integer punteroConsumoMinutos;
    private Integer ultimoMinutoSimulacion;

    private LocalDateTime fechaHoraInicioReal;
    private LocalDateTime fechaHoraInicioSimulacion;
    private Long duracionSolicitadaMinutos;
    private List<SolicitudEnvio> solicitudesPendientes = new ArrayList<>();
    private final List<SolicitudEnvio> enviosSimuladosProcesados = new ArrayList<>();
    private int siguienteIdEnvioVolatil = -1;
    private PlanificadorGenetico planificadorGA;
    private final SimulacionMetricas metricas = new SimulacionMetricas();

    private final Map<String, Aeropuerto> aeropuertosSimulados = new HashMap<>();
    private final Map<String, Integer> capacidadesBaseAeropuertos = new HashMap<>();
    private final Map<Integer, Vuelo> vuelosSimulados = new HashMap<>();
    private final Map<Long, VueloOcurrencia> ocurrenciasSimuladas = new LinkedHashMap<>();
    private long siguienteIdOcurrenciaVolatil = -1L;
    private Simulacion simulacionActual;
    private Integer ultimoIdSimulacion;
    private int indiceSiguienteSolicitud = 0;
    private final Map<Long, List<ReservaVueloSimulado>> reservasVuelosSimulados = new HashMap<>();
    private final List<ReservaAlmacenSimulado> reservasAlmacenesSimulados = new ArrayList<>();
    private final Map<Long, CancelacionVueloSimulada> cancelacionesVuelosSimulados = new HashMap<>();

    public SimulacionService(
            SimulacionCargaService simulacionCargaService,
            SimulacionEstadoService simulacionEstadoService,
            AeropuertoRepository aeropuertoRepository,
            SimulacionRepository simulacionRepository,
            VueloRepository vueloRepository,
            VueloCancelacionService vueloCancelacionService,
            VueloOcurrenciaService vueloOcurrenciaService,
            ResultadosSimulacionService resultadosSimulacionService,
            ObjectMapper objectMapper,
            SimulationSseService simulationSseService
    ) {
        this.simulacionCargaService = simulacionCargaService;
        this.simulacionEstadoService = simulacionEstadoService;
        this.aeropuertoRepository = aeropuertoRepository;
        this.simulacionRepository = simulacionRepository;
        this.vueloRepository = vueloRepository;
        this.vueloCancelacionService = vueloCancelacionService;
        this.vueloOcurrenciaService = vueloOcurrenciaService;
        this.resultadosSimulacionService = resultadosSimulacionService;
        this.objectMapper = objectMapper;
        this.simulationSseService = simulationSseService;
    }

    @PostConstruct
    public void cerrarSimulacionesActivasHuerfanas() {
        LocalDateTime ahora = LocalDateTime.now(ZoneOffset.UTC);

        for (Simulacion simulacion : simulacionRepository.findByActivaTrue()) {
            simulacion.setActiva(false);
            if (simulacion.getFechaFin() == null) {
                simulacion.setFechaFin(ahora);
            }
            simulacionRepository.save(simulacion);
        }
    }

    public synchronized EstadoSimulacion iniciarSimulacion(
            Integer k,
            LocalDate fechaInicio,
            LocalTime horaInicio,
            Integer duracionDias
    ) throws IOException {
        if (simulacionActiva) {
            throw new IllegalStateException("Ya existe una simulacion activa. Detenla antes de iniciar otra.");
        }

        if (k == null || k <= 0) {
            throw new IllegalArgumentException("El parametro k debe ser mayor que 0.");
        }

        if (fechaInicio == null) {
            throw new IllegalArgumentException("La fecha de inicio es obligatoria.");
        }

        if (duracionDias != null && duracionDias <= 0) {
            throw new IllegalArgumentException("La duracionDias debe ser mayor que 0 cuando se envia.");
        }

        LocalDateTime fechaHoraInicio = LocalDateTime.of(
                fechaInicio,
                horaInicio != null ? horaInicio : LocalTime.MIDNIGHT
        );

        this.kActual = k;
        this.scMinutos = k * SA_MINUTOS;
        this.intervaloRealActualMs = resolverIntervaloRealMs(duracionDias);
        this.ultimaEjecucionBloqueRealMs = System.currentTimeMillis();
        this.punteroConsumoMinutos = 0;
        this.indiceSiguienteSolicitud = 0;
        this.reservasVuelosSimulados.clear();
        this.reservasAlmacenesSimulados.clear();
        this.cancelacionesVuelosSimulados.clear();
        this.enviosSimuladosProcesados.clear();
        this.siguienteIdEnvioVolatil = -1;
        this.fechaHoraInicioReal = LocalDateTime.now(ZoneOffset.UTC);
        this.fechaHoraInicioSimulacion = fechaHoraInicio;
        this.duracionSolicitadaMinutos = duracionDias != null
                ? duracionDias.longValue() * VueloCancelacionService.MINUTOS_DIA
                : null;

        metricas.reiniciar();

        this.solicitudesPendientes = simulacionCargaService.cargarSolicitudes(
                fechaHoraInicioSimulacion,
                duracionDias
        );

        if (solicitudesPendientes.isEmpty()) {
            throw new IllegalArgumentException("No existen envios precargados dentro del rango solicitado.");
        }

        this.ultimoMinutoSimulacion = obtenerUltimoMinutoSimulacion(
                solicitudesPendientes,
                fechaHoraInicioSimulacion
        );

        Simulacion nuevaSimulacion = new Simulacion(k, fechaHoraInicioSimulacion, true);
        nuevaSimulacion.setCancelacionesVuelos(0);
        nuevaSimulacion.setDuracionSimulacionMinutos(duracionSolicitadaMinutos);
        this.simulacionActual = simulacionRepository.save(nuevaSimulacion);
        this.ultimoIdSimulacion = this.simulacionActual.getIdSimulacion();

        inicializarEstadoSimulado();
        this.simulacionActiva = true;

        EstadoSimulacion estadoInicial = obtenerEstado();
        publicarEstadoSimulacion("simulation.state");
        publicarMapaActualizado("simulation.started");
        publicarEnviosActualizados("simulation.started");
        return estadoInicial;
    }

    public synchronized void detenerSimulacion() {
        finalizarSimulacion();
    }

    public synchronized EstadoSimulacion obtenerEstado() {
        return simulacionEstadoService.construirEstado(
                simulacionActual != null ? simulacionActual.getIdSimulacion() : ultimoIdSimulacion,
                simulacionActiva,
                procesandoBloque,
                fechaHoraInicioReal,
                fechaHoraInicioSimulacion,
                kActual,
                SA_MINUTOS,
                scMinutos,
                intervaloRealActualMs,
                punteroConsumoMinutos,
                ultimoMinutoSimulacion,
                indiceSiguienteSolicitud,
                solicitudesPendientes,
                metricas
        );
    }

    private Integer obtenerIdSimulacionActualParaEventos() {
        return simulacionActual != null ? simulacionActual.getIdSimulacion() : ultimoIdSimulacion;
    }

    private void publicarEstadoSimulacion(String type) {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (idSimulacion == null) {
            return;
        }

        EstadoSimulacion estado = obtenerEstado();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("activa", estado.isActiva());
        payload.put("procesandoBloque", estado.isProcesandoBloque());
        payload.put("punteroConsumoMinutos", estado.getPunteroConsumoMinutos());
        payload.put("ultimoMinutoSimulacion", estado.getUltimoMinutoSimulacion());
        payload.put("bloquesProcesados", estado.getBloquesProcesados());
        payload.put("totalSolicitudes", estado.getTotalSolicitudes());
        payload.put("resueltas", estado.getResueltas());
        payload.put("noResueltas", estado.getNoResueltas());
        payload.put("porcentajeResueltas", estado.getPorcentajeResueltas());
        payload.put("fechaHoraInicioSimulacion", estado.getFechaHoraInicioSimulacion());

        simulationSseService.publish(idSimulacion, type, payload);
    }

    private void publicarMapaActualizado(String reason) {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (idSimulacion == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reason", reason);
        payload.put("punteroConsumoMinutos", punteroConsumoMinutos);

        simulationSseService.publish(idSimulacion, "map.updated", payload);
    }

    private void publicarEnviosActualizados(String reason) {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (idSimulacion == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reason", reason);
        payload.put("totalEnviosProcesados", enviosSimuladosProcesados.size());

        simulationSseService.publish(idSimulacion, "shipment.updated", payload);
    }

    private void publicarVueloCancelado(CancelacionVueloSimulada cancelacion) {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (idSimulacion == null || cancelacion == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("idOcurrencia", cancelacion.idOcurrencia());
        payload.put("idVuelo", cancelacion.idVuelo());
        payload.put("salidaMinuto", cancelacion.salidaMinuto());
        payload.put("cancelacionMinuto", cancelacion.cancelacionMinuto());

        simulationSseService.publish(idSimulacion, "flight.cancelled", payload);
    }

    private void publicarEnvioReplanificado(Integer idEnvio, int minutoReplanificacion) {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (idSimulacion == null || idEnvio == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("idEnvio", idEnvio);
        payload.put("minutoReplanificacion", minutoReplanificacion);

        simulationSseService.publish(idSimulacion, "shipment.replanned", payload);
    }

    private void publicarCambiosPorReplanificacion(Integer idEnvio, int minutoReplanificacion) {
        publicarEnvioReplanificado(idEnvio, minutoReplanificacion);
        publicarMapaActualizado("shipment.replanned");
        publicarEnviosActualizados("shipment.replanned");
    }

    public synchronized EstadoSimulacion obtenerEstado(Integer idSimulacion) {
        if (idSimulacion == null || !idSimulacion.equals(ultimoIdSimulacion)) {
            throw new IllegalArgumentException("No existe una simulacion con id " + idSimulacion + ".");
        }

        return obtenerEstado();
    }

    public synchronized List<SolicitudEnvio> obtenerEnviosSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);
        return List.copyOf(enviosSimuladosProcesados);
    }

    public synchronized MapaSimulacionEstado obtenerMapaSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);
        return construirMapaSimulacion(idSimulacion);
    }

    private MapaSimulacionEstado construirMapaSimulacion(Integer idSimulacion) {
        Map<String, Double> ocupacionPorAeropuerto = construirOcupacionPorAeropuerto(idSimulacion);
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = construirVuelosMapa(idSimulacion);
        List<MapaSimulacionEstado.CancelacionVueloMapa> cancelacionesMapa =
                construirCancelacionesRecientesMapa();

        return new MapaSimulacionEstado(
                idSimulacion,
                ocupacionPorAeropuerto,
                vuelosMapa,
                cancelacionesMapa
        );
    }

    @Scheduled(fixedRate = 1000)
    public synchronized void publicarSnapshotMapaProgramado() {
        Integer idSimulacion = obtenerIdSimulacionActualParaEventos();
        if (!simulacionActiva
                || idSimulacion == null
                || !simulationSseService.hasSubscribers(idSimulacion)) {
            return;
        }

        publicarSnapshotMapaActual(idSimulacion);
    }

    private void publicarSnapshotMapaActual(Integer idSimulacion) {
        if (idSimulacion == null || !simulationSseService.hasSubscribers(idSimulacion)) {
            return;
        }

        simulationSseService.publish(
                idSimulacion,
                "map.snapshot",
                construirMapaSimulacion(idSimulacion)
        );
    }

    public synchronized VueloOcurrencia obtenerOcurrenciaSimulada(Integer idSimulacion, Long idOcurrencia) {
        validarSimulacionSolicitada(idSimulacion);
        VueloOcurrencia ocurrencia = ocurrenciasSimuladas.get(idOcurrencia);
        if (ocurrencia == null) {
            throw new IllegalArgumentException("No existe una ocurrencia simulada con id " + idOcurrencia + ".");
        }
        actualizarEstadoOcurrenciaSimulada(ocurrencia, obtenerMinutoReferenciaMapa());
        return ocurrencia;
    }

    public synchronized List<VueloOcurrencia> listarOcurrenciasSimuladasPorAeropuerto(
            Integer idSimulacion,
            String codigoAeropuerto
    ) {
        return listarOcurrenciasSimuladasPorAeropuerto(idSimulacion, codigoAeropuerto, null);
    }

    public synchronized List<VueloOcurrencia> listarOcurrenciasSimuladasPorAeropuerto(
            Integer idSimulacion,
            String codigoAeropuerto,
            LocalDate fecha
    ) {
        validarSimulacionSolicitada(idSimulacion);
        int minutoReferencia = obtenerMinutoReferenciaMapa();
        return ocurrenciasSimuladas.values().stream()
                .filter(o -> fecha == null || o.getFechaHoraSalida().toLocalDate().equals(fecha))
                .filter(o -> codigoAeropuerto.equalsIgnoreCase(o.getVuelo().getDesde().getCodigo())
                        || codigoAeropuerto.equalsIgnoreCase(o.getVuelo().getHasta().getCodigo()))
                .peek(o -> actualizarEstadoOcurrenciaSimulada(o, minutoReferencia))
                .sorted(Comparator.comparing(VueloOcurrencia::getFechaHoraSalida))
                .toList();
    }

    public synchronized List<VueloOcurrencia> listarOcurrenciasSimuladas(Integer idSimulacion) {
        return listarOcurrenciasSimuladas(idSimulacion, null);
    }

    public synchronized List<VueloOcurrencia> listarOcurrenciasSimuladas(
            Integer idSimulacion,
            LocalDate fecha
    ) {
        validarSimulacionSolicitada(idSimulacion);
        int minutoReferencia = obtenerMinutoReferenciaMapa();
        return ocurrenciasSimuladas.values().stream()
                .filter(o -> fecha == null || o.getFechaHoraSalida().toLocalDate().equals(fecha))
                .peek(o -> actualizarEstadoOcurrenciaSimulada(o, minutoReferencia))
                .sorted(Comparator.comparing(VueloOcurrencia::getFechaHoraSalida))
                .toList();
    }

    public synchronized LocalDate obtenerFechaActual(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);
        if (fechaHoraInicioSimulacion == null) {
            throw new IllegalStateException("La simulacion no tiene una fecha de inicio valida.");
        }
        return fechaHoraInicioSimulacion
                .plusMinutes(Math.max(0, obtenerMinutoReferenciaMapa()))
                .toLocalDate();
    }

    public synchronized VueloOcurrencia cancelarVueloSimulado(
            Integer idSimulacion,
            Long idOcurrencia
    ) {
        validarSimulacionSolicitada(idSimulacion);
        int minutoCancelacion = obtenerMinutoReferenciaMapa();
        VueloOcurrencia ocurrencia = ocurrenciasSimuladas.get(idOcurrencia);
        if (ocurrencia == null) {
            throw new IllegalArgumentException("No existe la ocurrencia simulada solicitada.");
        }
        if (cancelacionesVuelosSimulados.containsKey(ocurrencia.getIdOcurrencia())) {
            return ocurrencia;
        }

        VueloOcurrencia ocurrenciaCancelable = resolverOcurrenciaSimuladaCancelable(
                ocurrencia,
                minutoCancelacion
        );
        int salidaMinuto = obtenerMinutoSalidaSimulada(ocurrenciaCancelable);
        cancelarOcurrenciaSimulada(ocurrenciaCancelable, salidaMinuto, minutoCancelacion, true);
        return ocurrenciaCancelable;
    }

    @Scheduled(fixedRate = INTERVALO_VERIFICACION_MS)
    @Transactional
    public synchronized void procesarSiguienteBloqueProgramado() {
        if (!simulacionActiva || procesandoBloque) {
            return;
        }

        aplicarCancelacionesPendientesHasta(obtenerMinutoReferenciaMapa());

        long ahoraRealMs = System.currentTimeMillis();
        if (!debeProcesarBloque(ahoraRealMs)) {
            return;
        }

        try {
            procesandoBloque = true;
            procesarSiguienteBloque();
        } finally {
            ultimaEjecucionBloqueRealMs = ahoraRealMs;
            procesandoBloque = false;
        }
    }

    private void procesarSiguienteBloque() {
        if (solicitudesPendientes == null || solicitudesPendientes.isEmpty()) {
            finalizarSimulacion();
            return;
        }

        if (punteroConsumoMinutos == null || scMinutos == null) {
            finalizarSimulacion();
            return;
        }

        if (punteroConsumoMinutos > ultimoMinutoSimulacion) {
            finalizarSimulacion();
            return;
        }

        int inicioVentana = punteroConsumoMinutos;
        int finVentana = punteroConsumoMinutos + scMinutos;

        actualizarReservasSimuladas(inicioVentana);
        aplicarCancelacionesPendientesHasta(obtenerMinutoReferenciaMapa());

        List<SolicitudEnvio> bloque = obtenerSolicitudesDelBloque(
                solicitudesPendientes,
                fechaHoraInicioSimulacion,
                inicioVentana,
                finVentana
        );

        for (SolicitudEnvio solicitud : bloque) {
            procesarSolicitudSimulada(solicitud);
        }

        metricas.incrementarBloquesProcesados();
        punteroConsumoMinutos += scMinutos;

        publicarEstadoSimulacion("simulation.state");
        publicarMapaActualizado("block.processed");
        if (!bloque.isEmpty()) {
            publicarEnviosActualizados("block.processed");
        }

        if (indiceSiguienteSolicitud >= solicitudesPendientes.size()
                || punteroConsumoMinutos > ultimoMinutoSimulacion) {
            finalizarSimulacion();
        }
    }

    private void procesarSolicitudSimulada(SolicitudEnvio solicitud) {
        metricas.incrementarTotalConsumidas();

        solicitud.setIdEnvio(siguienteIdEnvioVolatil--);
        solicitud.setIdSimulacionVolatil(simulacionActual.getIdSimulacion());
        solicitud.setEstado(EstadoEnvio.INGRESADO);
        SolicitudEnvio solicitudGuardada = solicitud;
        enviosSimuladosProcesados.add(solicitudGuardada);
        int minutoSolicitud = calcularMinutoSimulacion(solicitudGuardada, fechaHoraInicioSimulacion);
        actualizarReservasSimuladas(minutoSolicitud);

        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitudGuardada.getOrigen().getCodigo());

        if (origenSimulado == null || !origenSimulado.tieneCapacidad(solicitudGuardada.getContarBolsas())) {
            metricas.incrementarNoResueltasPorAlmacenOrigen();
            return;
        }

        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);

        long inicioPlanificacion = System.nanoTime();
        Ruta mejorRutaSimulada = encontrarRutaSimuladaFactible(solicitudGuardada, minutoSolicitud);
        long finPlanificacion = System.nanoTime();

        metricas.registrarTiempoPlanificacion(finPlanificacion - inicioPlanificacion);

        if (mejorRutaSimulada != null) {
            guardarAsignacionesSimuladas(
                    solicitudGuardada,
                    List.of(new AsignacionSimulada(
                            mejorRutaSimulada,
                            solicitudGuardada.getContarBolsas()
                    )),
                    minutoSolicitud
            );
            metricas.registrarRutaResuelta(mejorRutaSimulada.getCosto(), mejorRutaSimulada.getOcurrencias().size());
            return;
        }

        List<AsignacionSimulada> asignaciones = planificarSolicitudSimuladaDividida(
                solicitudGuardada,
                minutoSolicitud
        );

        if (asignaciones.isEmpty()) {
            metricas.incrementarNoResueltasPorRutaVueloPlazo();

            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            return;
        }

        guardarAsignacionesSimuladas(solicitudGuardada, asignaciones, minutoSolicitud);

        int cantidadVuelos = asignaciones.stream()
                .mapToInt(asignacion -> asignacion.ruta().getOcurrencias().size())
                .sum();
        double costoTotal = asignaciones.stream()
                .mapToDouble(asignacion -> asignacion.ruta().getCosto() != null
                        ? asignacion.ruta().getCosto()
                        : 0.0)
                .sum();
        metricas.registrarRutaResuelta(costoTotal, cantidadVuelos);
    }

    private void inicializarEstadoSimulado() {
        aeropuertosSimulados.clear();
        capacidadesBaseAeropuertos.clear();
        vuelosSimulados.clear();
        ocurrenciasSimuladas.clear();
        siguienteIdOcurrenciaVolatil = -1L;
        reservasVuelosSimulados.clear();
        reservasAlmacenesSimulados.clear();
        cancelacionesVuelosSimulados.clear();

        for (Aeropuerto aeropuertoReal : aeropuertoRepository.findAll()) {
            Aeropuerto aeropuertoClonado = clonarAeropuerto(aeropuertoReal);
            aeropuertosSimulados.put(aeropuertoClonado.getCodigo(), aeropuertoClonado);
            capacidadesBaseAeropuertos.put(aeropuertoReal.getCodigo(), aeropuertoReal.getCapacidad());
        }

        for (Vuelo vueloReal : vueloRepository.findAll()) {
            Vuelo vueloClonado = clonarVuelo(vueloReal);
            vuelosSimulados.put(vueloClonado.getIdVuelo(), vueloClonado);
        }

        inicializarOcurrenciasSimuladas();

        this.planificadorGA = null;
    }

    private void inicializarOcurrenciasSimuladas() {
        if (fechaHoraInicioSimulacion == null) {
            return;
        }
        long horizonte = duracionSolicitadaMinutos != null
                ? duracionSolicitadaMinutos
                : Math.max(
                        VueloCancelacionService.MINUTOS_DIA,
                        (ultimoMinutoSimulacion != null ? ultimoMinutoSimulacion : 0)
                                + VueloCancelacionService.MINUTOS_DIA
                );
        LocalDateTime fin = fechaHoraInicioSimulacion.plusMinutes(horizonte);
        List<VueloOcurrencia> generadas = vueloOcurrenciaService.crearOcurrenciasVolatiles(
                new ArrayList<>(vuelosSimulados.values()),
                fechaHoraInicioSimulacion,
                fin
        );
        for (VueloOcurrencia ocurrencia : generadas) {
            ocurrencia.setIdOcurrencia(siguienteIdOcurrenciaVolatil--);
            ocurrenciasSimuladas.put(ocurrencia.getIdOcurrencia(), ocurrencia);
        }
    }

    private void actualizarEstadoOcurrenciasSimuladas(int minutoReferencia) {
        for (VueloOcurrencia ocurrencia : ocurrenciasSimuladas.values()) {
            actualizarEstadoOcurrenciaSimulada(ocurrencia, minutoReferencia);
        }
    }

    private void actualizarEstadoOcurrenciaSimulada(
            VueloOcurrencia ocurrencia,
            int minutoReferencia
    ) {
        LocalDateTime referencia = fechaHoraInicioSimulacion.plusMinutes(Math.max(0, minutoReferencia));
        vueloOcurrenciaService.actualizarEstadoTemporal(ocurrencia, referencia);
        if (cancelacionesVuelosSimulados.containsKey(ocurrencia.getIdOcurrencia())) {
            ocurrencia.setEstado(EstadoVueloOcurrencia.CANCELADO);
        }
    }

    private VueloOcurrencia resolverOcurrenciaSimuladaCancelable(
            VueloOcurrencia ocurrencia,
            int minutoCancelacion
    ) {
        int salidaMinuto = obtenerMinutoSalidaSimulada(ocurrencia);
        if (salidaMinuto - minutoCancelacion >= VueloCancelacionService.MINUTOS_AVISO_MIN) {
            return ocurrencia;
        }

        Integer idVuelo = ocurrencia.getVuelo() != null
                ? ocurrencia.getVuelo().getIdVuelo()
                : null;
        if (idVuelo == null) {
            throw new IllegalArgumentException("La ocurrencia no tiene un vuelo valido.");
        }

        return ocurrenciasSimuladas.values().stream()
                .filter(candidata -> candidata.getVuelo() != null
                        && Objects.equals(candidata.getVuelo().getIdVuelo(), idVuelo))
                .filter(candidata -> !cancelacionesVuelosSimulados.containsKey(candidata.getIdOcurrencia()))
                .filter(candidata -> obtenerMinutoSalidaSimulada(candidata) - minutoCancelacion
                        >= VueloCancelacionService.MINUTOS_AVISO_MIN)
                .min(Comparator.comparing(VueloOcurrencia::getFechaHoraSalida))
                .orElseThrow(() -> new IllegalArgumentException(
                        "No existe una siguiente ocurrencia cancelable para este vuelo."
                ));
    }

    private int obtenerMinutoSalidaSimulada(VueloOcurrencia ocurrencia) {
        return (int) ChronoUnit.MINUTES.between(
                fechaHoraInicioSimulacion,
                ocurrencia.getFechaHoraSalida()
        );
    }

    private Aeropuerto clonarAeropuerto(Aeropuerto aeropuertoReal) {
        return new Aeropuerto(
                aeropuertoReal.getCodigo(),
                aeropuertoReal.getCiudad(),
                aeropuertoReal.getRegion(),
                aeropuertoReal.getPais(),
                aeropuertoReal.getAlias(),
                aeropuertoReal.getDesplazamientoGMT(),
                aeropuertoReal.getCapacidad(),
                aeropuertoReal.getLatitud(),
                aeropuertoReal.getLongitud()
        );
    }

    private Vuelo clonarVuelo(Vuelo vueloReal) {
        Aeropuerto desde = aeropuertosSimulados.get(vueloReal.getDesde().getCodigo());
        Aeropuerto hasta = aeropuertosSimulados.get(vueloReal.getHasta().getCodigo());

        Vuelo vueloClonado = new Vuelo(
                desde,
                hasta,
                vueloReal.getTiempoViajarDias(),
                vueloReal.getCapacidad(),
                vueloReal.getSalidaUtcMin(),
                vueloReal.getLlegadaUtcMin()
        );
        vueloClonado.setIdVuelo(vueloReal.getIdVuelo());
        return vueloClonado;
    }

    private SolicitudEnvio construirSolicitudSimulada(SolicitudEnvio solicitudReal) {
        return construirSolicitudSimulada(solicitudReal, solicitudReal.getContarBolsas());
    }

    private SolicitudEnvio construirSolicitudSimulada(SolicitudEnvio solicitudReal, Integer bolsas) {
        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitudReal.getOrigen().getCodigo());
        Aeropuerto destinoSimulado = aeropuertosSimulados.get(solicitudReal.getDestino().getCodigo());

        return new SolicitudEnvio(
                solicitudReal.getIdEnvio(),
                solicitudReal.getFecha(),
                solicitudReal.getHora(),
                solicitudReal.getIdCliente(),
                origenSimulado,
                destinoSimulado,
                bolsas,
                solicitudReal.getDiasTiempoMaximo()
        );
    }

    private Ruta encontrarRutaSimuladaFactible(SolicitudEnvio solicitudReal, int minutoInicio) {
        SolicitudEnvio solicitudSimulada = construirSolicitudSimulada(solicitudReal);
        Ruta ruta = crearPlanificadorSimulado(minutoInicio).encontrarMejorRuta(solicitudSimulada);
        return ruta != null && ruta.esFactible() ? ruta : null;
    }

    private List<AsignacionSimulada> planificarSolicitudSimuladaDividida(
            SolicitudEnvio solicitud,
            int minutoSolicitud
    ) {
        List<AsignacionSimulada> asignaciones = new ArrayList<>();
        int restante = solicitud.getContarBolsas() != null ? solicitud.getContarBolsas() : 0;

        while (restante > 0) {
            SolicitudEnvio solicitudMinima = construirSolicitudSimulada(solicitud, 1);
            Ruta ruta = crearPlanificadorSimulado(minutoSolicitud).encontrarMejorRuta(solicitudMinima);
            if (ruta == null || !ruta.esFactible()) {
                break;
            }

            int capacidadRuta = calcularCapacidadDisponibleRuta(ruta, minutoSolicitud);
            int bolsasAsignadas = Math.min(restante, capacidadRuta);
            if (bolsasAsignadas <= 0) {
                break;
            }

            List<ReservaVueloSimulado> reservasRuta = calcularReservasRuta(
                    ruta,
                    minutoSolicitud,
                    solicitud.getIdEnvio(),
                    bolsasAsignadas
            );
            registrarReservasRuta(
                    solicitud.getIdEnvio(),
                    solicitud.getOrigen().getCodigo(),
                    bolsasAsignadas,
                    reservasRuta,
                    minutoSolicitud
            );
            asignaciones.add(new AsignacionSimulada(ruta, bolsasAsignadas, true));
            restante -= bolsasAsignadas;
        }

        return asignaciones;
    }

    private SolicitudEnvio guardarAsignacionesSimuladas(
            SolicitudEnvio solicitud,
            List<AsignacionSimulada> asignaciones,
            int minutoReferencia
    ) {
        int totalAsignado = asignaciones.stream()
                .mapToInt(AsignacionSimulada::bolsas)
                .sum();

        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitud.getOrigen().getCodigo());
        if (origenSimulado != null) {
            origenSimulado.descontarCapacidad(totalAsignado);
        }

        Ruta rutaPrincipal = null;
        List<SolicitudEnvio.AsignacionEnvioVista> vistas = new ArrayList<>();
        for (AsignacionSimulada asignacion : asignaciones) {
            List<ReservaVueloSimulado> reservasRuta = calcularReservasRuta(
                    asignacion.ruta(),
                    minutoReferencia,
                    solicitud.getIdEnvio(),
                    asignacion.bolsas()
            );
            if (!asignacion.reservasRegistradas()) {
                registrarReservasRuta(
                        solicitud.getIdEnvio(),
                        solicitud.getOrigen().getCodigo(),
                        asignacion.bolsas(),
                        reservasRuta,
                        minutoReferencia
                );
            }

            Ruta rutaGuardada = asignacion.ruta();
            rutaGuardada.setOcurrencias(reservasRuta.stream()
                    .map(reserva -> ocurrenciasSimuladas.get(reserva.idOcurrencia()))
                    .filter(Objects::nonNull)
                    .toList());
            if (rutaPrincipal == null) {
                rutaPrincipal = rutaGuardada;
            }

            vistas.add(new SolicitudEnvio.AsignacionEnvioVista(
                    null,
                    rutaGuardada,
                    asignacion.bolsas(),
                    EstadoEnvio.EN_PROCESO
            ));
        }

        solicitud.setRuta(rutaPrincipal);
        solicitud.setEstado(totalAsignado >= solicitud.getContarBolsas()
                ? EstadoEnvio.EN_PROCESO
                : EstadoEnvio.PARCIAL);
        solicitud.setAsignaciones(vistas);

        return solicitud;
    }

    private int calcularCapacidadDisponibleRuta(Ruta ruta, int minutoInicio) {
        if (ruta == null || ruta.getOcurrencias().isEmpty()) {
            return 0;
        }

        int capacidad = Integer.MAX_VALUE;
        for (VueloOcurrencia ocurrencia : ruta.getOcurrencias()) {
            if (ocurrencia == null || ocurrencia.getEstado() == EstadoVueloOcurrencia.CANCELADO) {
                return 0;
            }
            capacidad = Math.min(capacidad, ocurrencia.getCapacidadDisponible());
        }

        return capacidad == Integer.MAX_VALUE ? 0 : capacidad;
    }

    private void finalizarSimulacion() {
        Integer idSimulacionFinal = simulacionActual != null
                ? simulacionActual.getIdSimulacion()
                : ultimoIdSimulacion;

        if (this.simulacionActual != null) {
            long duracionFinalMinutos = calcularDuracionFinalMinutos();
            this.simulacionActual.setActiva(false);
            this.simulacionActual.setFechaFin(fechaHoraInicioSimulacion != null
                    ? fechaHoraInicioSimulacion.plusMinutes(duracionFinalMinutos)
                    : LocalDateTime.now(ZoneOffset.UTC));
            this.simulacionActual.setCancelacionesVuelos(cancelacionesVuelosSimulados.size());
            this.simulacionActual.setDuracionSimulacionMinutos(duracionFinalMinutos);
            simulacionRepository.save(this.simulacionActual);
            resultadosSimulacionService.guardarResultadoFinal(
                    this.simulacionActual,
                    List.copyOf(enviosSimuladosProcesados)
            );
        }

        EstadoSimulacion estadoFinal = simulacionEstadoService.construirEstado(
                idSimulacionFinal,
                false,
                false,
                fechaHoraInicioReal,
                fechaHoraInicioSimulacion,
                kActual,
                SA_MINUTOS,
                scMinutos,
                intervaloRealActualMs,
                punteroConsumoMinutos,
                ultimoMinutoSimulacion,
                indiceSiguienteSolicitud,
                solicitudesPendientes,
                metricas
        );
        if (idSimulacionFinal != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("resultadoDisponible", true);
            payload.put("activa", false);
            payload.put("fechaFin", fechaHoraInicioSimulacion != null
                    ? formatearUtc(fechaHoraInicioSimulacion
                            .plusMinutes(estadoFinal.getPunteroConsumoMinutos() != null
                                    ? estadoFinal.getPunteroConsumoMinutos()
                                    : 0))
                    : null);
            simulationSseService.publish(idSimulacionFinal, "simulation.finished", payload);
            simulationSseService.publish(idSimulacionFinal, "simulation.state", Map.of(
                    "activa", false,
                    "resultadoDisponible", true
            ));
        }
        imprimirEstadoFinalJson(estadoFinal);

        this.simulacionActiva = false;
        this.procesandoBloque = false;
        this.planificadorGA = null;
        this.fechaHoraInicioReal = null;
        this.fechaHoraInicioSimulacion = null;
        this.duracionSolicitadaMinutos = null;
        this.simulacionActual = null;
        this.intervaloRealActualMs = null;
        this.ultimaEjecucionBloqueRealMs = null;
    }

    private long calcularDuracionFinalMinutos() {
        if (duracionSolicitadaMinutos != null
                && duracionSolicitadaMinutos > 0
                && simulacionCompletoRangoCargado()) {
            return duracionSolicitadaMinutos;
        }

        long puntero = punteroConsumoMinutos != null ? punteroConsumoMinutos.longValue() : 0L;
        long ultimo = ultimoMinutoSimulacion != null ? ultimoMinutoSimulacion.longValue() : 0L;
        long procesado = Math.max(puntero, ultimo);

        return Math.max(1L, procesado);
    }

    private boolean simulacionCompletoRangoCargado() {
        boolean consumioSolicitudes = solicitudesPendientes != null
                && indiceSiguienteSolicitud >= solicitudesPendientes.size();
        boolean consumioHorizonte = punteroConsumoMinutos != null
                && ultimoMinutoSimulacion != null
                && punteroConsumoMinutos > ultimoMinutoSimulacion;

        return consumioSolicitudes || consumioHorizonte;
    }

    private long resolverIntervaloRealMs(Integer duracionDias) {
        if (duracionDias != null && duracionDias == DURACION_SEMANAL_DIAS) {
            return INTERVALO_REAL_SEMANAL_MS;
        }

        return INTERVALO_REAL_COLAPSO_MS;
    }

    private boolean debeProcesarBloque(long ahoraRealMs) {
        if (intervaloRealActualMs == null || intervaloRealActualMs <= 0) {
            return true;
        }

        if (ultimaEjecucionBloqueRealMs == null) {
            return true;
        }

        return ahoraRealMs - ultimaEjecucionBloqueRealMs >= intervaloRealActualMs;
    }

    private void validarSimulacionSolicitada(Integer idSimulacion) {
        if (idSimulacion == null || !idSimulacion.equals(ultimoIdSimulacion)) {
            throw new IllegalArgumentException("No existe una simulacion con id " + idSimulacion + ".");
        }
    }

    private Map<String, Double> construirOcupacionPorAeropuerto(Integer idSimulacion) {
        Map<String, Double> ocupacion = new LinkedHashMap<>();

        if (simulacionActual != null && idSimulacion.equals(simulacionActual.getIdSimulacion())) {
            int minutoReferencia = obtenerMinutoReferenciaMapa();
            for (Aeropuerto aeropuerto : aeropuertosSimulados.values()) {
                Integer capacidadBase = capacidadesBaseAeropuertos.getOrDefault(
                        aeropuerto.getCodigo(), aeropuerto.getCapacidad());
                int capacidadVisual = calcularCapacidadVisualAeropuerto(
                        aeropuerto,
                        capacidadBase,
                        minutoReferencia
                );
                double porcentaje = calcularOcupacionPorcentaje(
                        capacidadVisual,
                        capacidadBase
                );
                ocupacion.put(aeropuerto.getCodigo(), porcentaje);
            }
            return ocupacion;
        }

        capacidadesBaseAeropuertos.keySet().forEach(codigo -> ocupacion.put(codigo, 0.0));

        return ocupacion;
    }

    private int calcularCapacidadVisualAeropuerto(
            Aeropuerto aeropuerto,
            Integer capacidadBase,
            int minutoReferencia
    ) {
        if (aeropuerto == null) {
            return 0;
        }

        String codigoAeropuerto = aeropuerto.getCodigo();
        int capacidadActual = aeropuerto.getCapacidad() != null ? aeropuerto.getCapacidad() : 0;
        int capacidadVisual = capacidadActual;

        for (ReservaAlmacenSimulado reserva : reservasAlmacenesSimulados) {
            if (!Objects.equals(reserva.codigoAeropuerto(), codigoAeropuerto)
                    || reserva.minutoEvento() > minutoReferencia) {
                continue;
            }

            capacidadVisual += reserva.deltaCapacidad();
        }

        int capacidadMaxima = capacidadBase != null && capacidadBase > 0
                ? capacidadBase
                : Math.max(0, capacidadActual);
        return Math.max(0, Math.min(capacidadMaxima, capacidadVisual));
    }

    private double calcularOcupacionPorcentaje(Integer capacidadActual, Integer capacidadBase) {
        if (capacidadBase == null || capacidadBase <= 0) {
            return 0.0;
        }

        int actual = capacidadActual != null ? capacidadActual : 0;
        double usado = Math.max(0, capacidadBase - actual);
        return Math.min(100.0, (usado * 100.0) / capacidadBase);
    }

    private List<MapaSimulacionEstado.VueloMapa> construirVuelosMapa(Integer idSimulacion) {
        if (punteroConsumoMinutos == null || ocurrenciasSimuladas.isEmpty()) {
            return List.of();
        }

        int minutoReferencia = obtenerMinutoReferenciaMapa();
        actualizarEstadoOcurrenciasSimuladas(minutoReferencia);
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = new ArrayList<>();

        for (VueloOcurrencia ocurrencia : ocurrenciasSimuladas.values()) {
            Vuelo vuelo = ocurrencia.getVuelo();
            if (vuelo == null || vuelo.getIdVuelo() == null
                    || vuelo.getDesde() == null
                    || vuelo.getDesde().getCodigo() == null
                    || vuelo.getHasta() == null
                    || vuelo.getHasta().getCodigo() == null) {
                continue;
            }
            int salidaMinuto = (int) ChronoUnit.MINUTES.between(fechaHoraInicioSimulacion, ocurrencia.getFechaHoraSalida());
            int llegadaMinuto = (int) ChronoUnit.MINUTES.between(fechaHoraInicioSimulacion, ocurrencia.getFechaHoraLlegada());
            if (minutoReferencia < salidaMinuto
                    || minutoReferencia >= llegadaMinuto
                    || ocurrencia.getEstado() == EstadoVueloOcurrencia.CANCELADO) {
                continue;
            }
            int capacidad = ocurrencia.getCapacidad() != null ? ocurrencia.getCapacidad() : 0;
            int bolsasActivas = ocurrencia.getCapacidadUsada() != null ? ocurrencia.getCapacidadUsada() : 0;
            double occupancyPct = capacidad <= 0
                    ? 0.0
                    : Math.min(100.0, (bolsasActivas * 100.0) / capacidad);
            double progress = Math.max(
                    0.001,
                    Math.min(
                            0.999,
                            (minutoReferencia - salidaMinuto)
                                    / (double) Math.max(1, llegadaMinuto - salidaMinuto)
                    )
            );

            vuelosMapa.add(new MapaSimulacionEstado.VueloMapa(
                    String.valueOf(ocurrencia.getIdOcurrencia()),
                    String.valueOf(vuelo.getIdVuelo()),
                    vuelo.getDesde().getCodigo(),
                    vuelo.getHasta().getCodigo(),
                    progress,
                    occupancyPct,
                    salidaMinuto,
                    llegadaMinuto,
                    Math.max(1, llegadaMinuto - salidaMinuto)
            ));
        }

        return vuelosMapa;
    }

    private int obtenerMinutoReferenciaMapa() {
        int fallback = Math.max(0, punteroConsumoMinutos != null ? punteroConsumoMinutos : 0);

        if (!simulacionActiva
                || fechaHoraInicioReal == null
                || scMinutos == null
                || intervaloRealActualMs == null
                || intervaloRealActualMs <= 0) {
            return fallback;
        }

        long realMs = Math.max(
                0,
                ChronoUnit.MILLIS.between(fechaHoraInicioReal, LocalDateTime.now(ZoneOffset.UTC))
        );
        long minutoVisual = (realMs * scMinutos) / intervaloRealActualMs;
        int referencia = (int) Math.min(Integer.MAX_VALUE, minutoVisual);

        if (ultimoMinutoSimulacion != null) {
            referencia = Math.min(referencia, Math.max(fallback, ultimoMinutoSimulacion));
        }

        return Math.max(fallback, referencia);
    }

    private List<MapaSimulacionEstado.CancelacionVueloMapa> construirCancelacionesRecientesMapa() {
        if (punteroConsumoMinutos == null || cancelacionesVuelosSimulados.isEmpty()) {
            return List.of();
        }

        int minutoReferencia = obtenerMinutoReferenciaMapa();
        int ventanaMinutos = Math.max(
                VENTANA_CANCELACIONES_MAPA_MIN,
                scMinutos != null ? scMinutos * 2 : 0
        );
        int desdeMinuto = Math.max(0, minutoReferencia - ventanaMinutos);

        return cancelacionesVuelosSimulados.values().stream()
                .filter(cancelacion -> cancelacion.cancelacionMinuto() >= desdeMinuto)
                .filter(cancelacion -> cancelacion.cancelacionMinuto() <= minutoReferencia)
                .map(cancelacion -> {
                    Vuelo vuelo = vuelosSimulados.get(cancelacion.idVuelo());
                    if (vuelo == null || vuelo.getDesde() == null) {
                        return null;
                    }

                    return new MapaSimulacionEstado.CancelacionVueloMapa(
                            "sim-cancel-" + cancelacion.idVuelo()
                                    + "-" + cancelacion.salidaMinuto()
                                    + "-" + cancelacion.cancelacionMinuto(),
                            vuelo.getDesde().getCodigo(),
                            construirCodigoVisualVuelo(vuelo)
                    );
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private String construirCodigoVisualVuelo(Vuelo vuelo) {
        if (vuelo == null) {
            return "sin dato";
        }

        String desde = vuelo.getDesde() != null && vuelo.getDesde().getCodigo() != null
                ? vuelo.getDesde().getCodigo()
                : "?";
        String hasta = vuelo.getHasta() != null && vuelo.getHasta().getCodigo() != null
                ? vuelo.getHasta().getCodigo()
                : "?";
        String idVuelo = vuelo.getIdVuelo() != null
                ? String.valueOf(vuelo.getIdVuelo())
                : "sin-id";

        return desde + ">" + hasta + "-" + idVuelo;
    }

    private PlanificadorGenetico crearPlanificadorSimulado(int minutoInicio) {
        return new PlanificadorGenetico(
                construirGrafoSimulado(),
                TAMANO_POBLACION,
                GENERACIONES,
                TASA_CRUZAMIENTO,
                TASA_MUTACION,
                TAMANO_TORNEO,
                ESCALAS_INTERMEDIAS_MAX,
                fechaHoraInicioSimulacion.plusMinutes(minutoInicio)
        );
    }

    private Grafo construirGrafoSimulado() {
        Grafo grafo = new Grafo();

        for (Aeropuerto aeropuerto : aeropuertosSimulados.values()) {
            grafo.agregarAeropuerto(aeropuerto);
        }

        for (VueloOcurrencia ocurrencia : ocurrenciasSimuladas.values()) {
            grafo.agregarOcurrencia(ocurrencia);
        }

        return grafo;
    }

    private void actualizarReservasSimuladas(int minutoSimulacion) {
        liberarReservasAlmacen(minutoSimulacion);
        liberarReservasVuelos(minutoSimulacion);
        reconstruirCapacidadVuelosDesdeReservas(minutoSimulacion);
    }

    private void aplicarCancelacionesPendientesHasta(int minutoReferencia) {
        if (vuelosSimulados.isEmpty()) {
            return;
        }

        for (VueloOcurrencia ocurrencia : ocurrenciasSimuladas.values()) {
            Vuelo vuelo = ocurrencia.getVuelo();
            int salidaMinuto = (int) ChronoUnit.MINUTES.between(fechaHoraInicioSimulacion, ocurrencia.getFechaHoraSalida());
            if (cancelacionesVuelosSimulados.containsKey(ocurrencia.getIdOcurrencia())
                    || !vueloCancelacionService.debeCancelar(vuelo, salidaMinuto)) continue;
            int cancelacionMinuto = vueloCancelacionService.calcularMinutoCancelacionSimulada(vuelo, salidaMinuto);
            if (cancelacionMinuto > minutoReferencia) continue;
            cancelarOcurrenciaSimulada(ocurrencia, salidaMinuto, cancelacionMinuto, true);
        }
    }

    private boolean cancelarOcurrenciaSimulada(
            VueloOcurrencia ocurrencia,
            int salidaMinuto,
            int cancelacionMinuto,
            boolean publicarEstado
    ) {
        if (ocurrencia == null
                || ocurrencia.getIdOcurrencia() == null
                || ocurrencia.getVuelo() == null
                || ocurrencia.getVuelo().getIdVuelo() == null
                || cancelacionesVuelosSimulados.containsKey(ocurrencia.getIdOcurrencia())) {
            return false;
        }

        CancelacionVueloSimulada cancelacion = new CancelacionVueloSimulada(
                ocurrencia.getIdOcurrencia(),
                ocurrencia.getVuelo().getIdVuelo(),
                salidaMinuto,
                cancelacionMinuto
        );

        cancelacionesVuelosSimulados.put(ocurrencia.getIdOcurrencia(), cancelacion);
        ocurrencia.setEstado(EstadoVueloOcurrencia.CANCELADO);
        replanificarEnviosAfectadosPorCancelacion(cancelacion);
        publicarVueloCancelado(cancelacion);
        if (publicarEstado) {
            publicarEstadoSimulacion("simulation.state");
        }
        publicarMapaActualizado("flight.cancelled");
        publicarEnviosActualizados("flight.cancelled");
        publicarSnapshotMapaActual(obtenerIdSimulacionActualParaEventos());
        return true;
    }

    private void replanificarEnviosAfectadosPorCancelacion(CancelacionVueloSimulada cancelacion) {
        List<Integer> enviosAfectados = reservasVuelosSimulados
                .getOrDefault(cancelacion.idOcurrencia(), List.of())
                .stream()
                .filter(reserva -> reserva.salidaMinuto() == cancelacion.salidaMinuto())
                .filter(reserva -> reserva.salidaMinuto() > cancelacion.cancelacionMinuto())
                .map(ReservaVueloSimulado::idEnvio)
                .distinct()
                .toList();

        for (Integer idEnvio : enviosAfectados) {
            replanificarEnvioSimulado(idEnvio, cancelacion.cancelacionMinuto());
        }
    }

    private void replanificarEnvioSimulado(Integer idEnvio, int minutoReplanificacion) {
        SolicitudEnvio envio = enviosSimuladosProcesados.stream()
                .filter(candidato -> Objects.equals(candidato.getIdEnvio(), idEnvio))
                .findFirst()
                .orElse(null);
        if (envio == null || envio.getEstado() == EstadoEnvio.COMPLETADO) {
            return;
        }

        liberarReservasEnvioSimulado(envio, minutoReplanificacion);
        actualizarReservasSimuladas(minutoReplanificacion);
        envio.setAsignaciones(List.of());

        Aeropuerto origenSimulado = aeropuertosSimulados.get(envio.getOrigen().getCodigo());
        if (origenSimulado == null || !origenSimulado.tieneCapacidad(envio.getContarBolsas())) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            publicarCambiosPorReplanificacion(idEnvio, minutoReplanificacion);
            return;
        }

        Ruta rutaReplanificada = encontrarRutaSimuladaFactible(envio, minutoReplanificacion);

        if (rutaReplanificada != null) {
            guardarAsignacionesSimuladas(
                    envio,
                    List.of(new AsignacionSimulada(
                            rutaReplanificada,
                            envio.getContarBolsas()
                    )),
                    minutoReplanificacion
            );
            publicarCambiosPorReplanificacion(idEnvio, minutoReplanificacion);
            return;
        }

        List<AsignacionSimulada> asignaciones = planificarSolicitudSimuladaDividida(
                envio,
                minutoReplanificacion
        );

        if (asignaciones.isEmpty()) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            publicarCambiosPorReplanificacion(idEnvio, minutoReplanificacion);
            return;
        }

        guardarAsignacionesSimuladas(envio, asignaciones, minutoReplanificacion);
        publicarCambiosPorReplanificacion(idEnvio, minutoReplanificacion);
    }

    private void liberarReservasEnvioSimulado(SolicitudEnvio envio, int minutoReferencia) {
        Map<String, Integer> capacidadARestaurarPorAeropuerto = reservasAlmacenesSimulados.stream()
                .filter(reserva -> reserva.idEnvio().equals(envio.getIdEnvio()))
                .filter(reserva -> reserva.minutoEvento() > minutoReferencia)
                .filter(reserva -> reserva.deltaCapacidad() > 0)
                .collect(Collectors.groupingBy(
                        ReservaAlmacenSimulado::codigoAeropuerto,
                        Collectors.summingInt(ReservaAlmacenSimulado::deltaCapacidad)
                ));

        reservasAlmacenesSimulados.removeIf(reserva -> reserva.idEnvio().equals(envio.getIdEnvio()));

        for (List<ReservaVueloSimulado> reservas : reservasVuelosSimulados.values()) {
            reservas.removeIf(reserva -> reserva.idEnvio().equals(envio.getIdEnvio()));
        }
        reservasVuelosSimulados.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        for (Map.Entry<String, Integer> entry : capacidadARestaurarPorAeropuerto.entrySet()) {
            Aeropuerto aeropuerto = aeropuertosSimulados.get(entry.getKey());
            if (aeropuerto != null && entry.getValue() > 0) {
                aeropuerto.aumentarCapacidad(entry.getValue());
            }
        }
    }

    private void liberarReservasAlmacen(int minutoSimulacion) {
        Iterator<ReservaAlmacenSimulado> iterator = reservasAlmacenesSimulados.iterator();

        while (iterator.hasNext()) {
            ReservaAlmacenSimulado reserva = iterator.next();

            if (reserva.minutoEvento() > minutoSimulacion) {
                continue;
            }

            Aeropuerto aeropuerto = aeropuertosSimulados.get(reserva.codigoAeropuerto());
            if (aeropuerto != null) {
                aplicarDeltaCapacidadAlmacen(aeropuerto, reserva.deltaCapacidad());
            }

            iterator.remove();
        }
    }

    private void aplicarDeltaCapacidadAlmacen(Aeropuerto aeropuerto, int deltaCapacidad) {
        if (deltaCapacidad == 0) {
            return;
        }

        int capacidadActual = aeropuerto.getCapacidad() != null ? aeropuerto.getCapacidad() : 0;
        if (deltaCapacidad > 0) {
            int capacidadBase = capacidadesBaseAeropuertos.getOrDefault(
                    aeropuerto.getCodigo(), capacidadActual + deltaCapacidad);
            aeropuerto.setCapacidad(Math.min(capacidadBase, capacidadActual + deltaCapacidad));
            return;
        }

        aeropuerto.setCapacidad(Math.max(0, capacidadActual + deltaCapacidad));
    }

    private void liberarReservasVuelos(int minutoSimulacion) {
        Iterator<Map.Entry<Long, List<ReservaVueloSimulado>>> iterator = reservasVuelosSimulados.entrySet().iterator();

        while (iterator.hasNext()) {
            Map.Entry<Long, List<ReservaVueloSimulado>> entry = iterator.next();
            entry.getValue().removeIf(reserva -> reserva.llegadaMinuto() <= minutoSimulacion);

            if (entry.getValue().isEmpty()) {
                iterator.remove();
            }
        }
    }

    private void reconstruirCapacidadVuelosDesdeReservas(int minutoSimulacion) {
        for (VueloOcurrencia ocurrencia : ocurrenciasSimuladas.values()) {
            ocurrencia.setCapacidadUsada(0);
        }

        for (Map.Entry<Long, List<ReservaVueloSimulado>> entry : reservasVuelosSimulados.entrySet()) {
            VueloOcurrencia ocurrencia = ocurrenciasSimuladas.get(entry.getKey());
            if (ocurrencia == null) continue;

            boolean enVuelo = entry.getValue().stream()
                    .anyMatch(reserva -> reserva.salidaMinuto() <= minutoSimulacion
                            && reserva.llegadaMinuto() > minutoSimulacion);

            int capacidadEnVuelo = entry.getValue().stream()
                    .filter(reserva -> reserva.salidaMinuto() <= minutoSimulacion
                            && reserva.llegadaMinuto() > minutoSimulacion)
                    .mapToInt(ReservaVueloSimulado::bolsas)
                    .sum();

            if (enVuelo) {
                ocurrencia.setCapacidadUsada(Math.min(ocurrencia.getCapacidad(), capacidadEnVuelo));
                continue;
            }

            int capacidadReservada = entry.getValue().stream()
                    .mapToInt(ReservaVueloSimulado::bolsas)
                    .sum();
            ocurrencia.setCapacidadUsada(Math.min(ocurrencia.getCapacidad(), capacidadReservada));
        }
        actualizarEstadoOcurrenciasSimuladas(minutoSimulacion);
    }

    private List<ReservaVueloSimulado> calcularReservasRuta(
            Ruta ruta,
            int minutoInicio,
            Integer idEnvio,
            int bolsas
    ) {
        List<ReservaVueloSimulado> reservas = new ArrayList<>();

        if (ruta == null) {
            return reservas;
        }
        for (VueloOcurrencia ocurrencia : ruta.getOcurrencias()) {
            Vuelo vuelo = ocurrencia.getVuelo();
            int salida = (int) ChronoUnit.MINUTES.between(fechaHoraInicioSimulacion, ocurrencia.getFechaHoraSalida());
            int llegada = (int) ChronoUnit.MINUTES.between(fechaHoraInicioSimulacion, ocurrencia.getFechaHoraLlegada());
            reservas.add(new ReservaVueloSimulado(
                    idEnvio,
                    ocurrencia.getIdOcurrencia(),
                    vuelo.getIdVuelo(),
                    bolsas,
                    salida,
                    llegada
            ));
        }

        return reservas;
    }

    private void registrarReservasRuta(
            Integer idEnvio,
            String codigoOrigen,
            int bolsas,
            List<ReservaVueloSimulado> reservasRuta,
            int minutoReferencia
    ) {
        if (reservasRuta.isEmpty()) {
            return;
        }

        ReservaVueloSimulado primeraReserva = reservasRuta.get(0);
        reservasAlmacenesSimulados.add(new ReservaAlmacenSimulado(
                idEnvio,
                codigoOrigen,
                bolsas,
                primeraReserva.salidaMinuto()
        ));

        for (int i = 0; i < reservasRuta.size() - 1; i++) {
            ReservaVueloSimulado llegada = reservasRuta.get(i);
            ReservaVueloSimulado siguienteSalida = reservasRuta.get(i + 1);
            Vuelo vuelo = vuelosSimulados.get(llegada.idVuelo());
            if (vuelo == null || vuelo.getHasta() == null || vuelo.getHasta().getCodigo() == null) {
                continue;
            }

            String codigoEscala = vuelo.getHasta().getCodigo();
            reservasAlmacenesSimulados.add(new ReservaAlmacenSimulado(
                    idEnvio,
                    codigoEscala,
                    -bolsas,
                    llegada.llegadaMinuto()
            ));
            reservasAlmacenesSimulados.add(new ReservaAlmacenSimulado(
                    idEnvio,
                    codigoEscala,
                    bolsas,
                    siguienteSalida.salidaMinuto()
            ));
        }

        for (ReservaVueloSimulado reserva : reservasRuta) {
            reservasVuelosSimulados.computeIfAbsent(
                            reserva.idOcurrencia(),
                            ignored -> new ArrayList<>()
                    )
                    .add(reserva);
        }

        reconstruirCapacidadVuelosDesdeReservas(minutoReferencia);
    }

    private List<SolicitudEnvio> obtenerSolicitudesDelBloque(
            List<SolicitudEnvio> solicitudes,
            LocalDateTime fechaHoraInicioSimulacion,
            int inicioVentana,
            int finVentana
    ) {
        List<SolicitudEnvio> bloque = new ArrayList<>();

        while (indiceSiguienteSolicitud < solicitudes.size()) {
            SolicitudEnvio solicitud = solicitudes.get(indiceSiguienteSolicitud);
            int minutoSimulacion = calcularMinutoSimulacion(solicitud, fechaHoraInicioSimulacion);

            if (minutoSimulacion < inicioVentana) {
                indiceSiguienteSolicitud++;
                continue;
            }

            if (minutoSimulacion >= finVentana) {
                break;
            }

            bloque.add(solicitud);
            indiceSiguienteSolicitud++;
        }

        return bloque;
    }

    private int calcularMinutoSimulacion(
            SolicitudEnvio solicitud,
            LocalDateTime fechaHoraInicioSimulacion
    ) {
        LocalDateTime fechaHoraSolicitud = solicitud.getFechaHoraRegistro();

        if (fechaHoraSolicitud == null || fechaHoraInicioSimulacion == null) {
            return 0;
        }

        return (int) ChronoUnit.MINUTES.between(
                fechaHoraInicioSimulacion,
                fechaHoraSolicitud
        );
    }

    private int obtenerUltimoMinutoSimulacion(
            List<SolicitudEnvio> solicitudes,
            LocalDateTime fechaHoraInicioSimulacion
    ) {
        return solicitudes.stream()
                .mapToInt(solicitud -> calcularMinutoSimulacion(solicitud, fechaHoraInicioSimulacion))
                .max()
                .orElse(0);
    }

    private String formatearUtc(LocalDateTime fechaHora) {
        return fechaHora != null ? fechaHora.format(ISO_FORMATTER) + "Z" : null;
    }

    private void imprimirEstadoFinalJson(EstadoSimulacion estadoFinal) {
        try {
            String estadoJson = objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(estadoFinal);
            LOGGER.info("Estado final de la simulacion:\n{}", estadoJson);
        } catch (JsonProcessingException e) {
            LOGGER.error("No se pudo serializar el estado final de la simulacion.", e);
        }
    }

    private record ReservaVueloSimulado(
            Integer idEnvio,
            Long idOcurrencia,
            Integer idVuelo,
            int bolsas,
            int salidaMinuto,
            int llegadaMinuto
    ) {
    }

    private record ReservaAlmacenSimulado(
            Integer idEnvio,
            String codigoAeropuerto,
            int deltaCapacidad,
            int minutoEvento
    ) {
    }

    private record AsignacionSimulada(
            Ruta ruta,
            int bolsas,
            boolean reservasRegistradas
    ) {
        private AsignacionSimulada(Ruta ruta, int bolsas) {
            this(ruta, bolsas, false);
        }
    }

    private record CancelacionVueloSimulada(
            Long idOcurrencia,
            Integer idVuelo,
            int salidaMinuto,
            int cancelacionMinuto
    ) {
    }
}
