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
import pucp.edu.pe.tasfb2b.entities.AsignacionEnvio;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.RutaRepository;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    private final SimulacionCargaService simulacionCargaService;
    private final SimulacionEstadoService simulacionEstadoService;
    private final AeropuertoRepository aeropuertoRepository;
    private final AsignacionEnvioRepository asignacionEnvioRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final RutaRepository rutaRepository;
    private final SimulacionRepository simulacionRepository;
    private final VueloRepository vueloRepository;
    private final VueloCancelacionService vueloCancelacionService;
    private final ObjectMapper objectMapper;

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
    private PlanificadorGenetico planificadorGA;
    private final SimulacionMetricas metricas = new SimulacionMetricas();

    private final Map<String, Aeropuerto> aeropuertosSimulados = new HashMap<>();
    private final Map<Integer, Vuelo> vuelosSimulados = new HashMap<>();
    private Simulacion simulacionActual;
    private Integer ultimoIdSimulacion;
    private int indiceSiguienteSolicitud = 0;
    private final Map<Integer, List<ReservaVueloSimulado>> reservasVuelosSimulados = new HashMap<>();
    private final List<ReservaAlmacenSimulado> reservasAlmacenesSimulados = new ArrayList<>();
    private final Map<ClaveVueloSimulado, CancelacionVueloSimulada> cancelacionesVuelosSimulados = new HashMap<>();

    public SimulacionService(
            SimulacionCargaService simulacionCargaService,
            SimulacionEstadoService simulacionEstadoService,
            AeropuertoRepository aeropuertoRepository,
            AsignacionEnvioRepository asignacionEnvioRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            RutaRepository rutaRepository,
            SimulacionRepository simulacionRepository,
            VueloRepository vueloRepository,
            VueloCancelacionService vueloCancelacionService,
            ObjectMapper objectMapper
    ) {
        this.simulacionCargaService = simulacionCargaService;
        this.simulacionEstadoService = simulacionEstadoService;
        this.aeropuertoRepository = aeropuertoRepository;
        this.asignacionEnvioRepository = asignacionEnvioRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.rutaRepository = rutaRepository;
        this.simulacionRepository = simulacionRepository;
        this.vueloRepository = vueloRepository;
        this.vueloCancelacionService = vueloCancelacionService;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void cerrarSimulacionesActivasHuerfanas() {
        LocalDateTime ahora = LocalDateTime.now();

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
        this.fechaHoraInicioReal = LocalDateTime.now();
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

        return obtenerEstado();
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

    public synchronized EstadoSimulacion obtenerEstado(Integer idSimulacion) {
        if (idSimulacion == null || !idSimulacion.equals(ultimoIdSimulacion)) {
            throw new IllegalArgumentException("No existe una simulacion con id " + idSimulacion + ".");
        }

        return obtenerEstado();
    }

    public synchronized List<SolicitudEnvio> obtenerEnviosSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);
        List<SolicitudEnvio> envios = solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);

        if (vuelosSimulados.isEmpty()) {
            return adjuntarAsignaciones(envios, false);
        }

        List<SolicitudEnvio> enviosClonados = envios.stream()
                .map(this::clonarSolicitudConRutaSimulada)
                .collect(Collectors.toList());

        return adjuntarAsignaciones(enviosClonados, true);
    }

    public synchronized MapaSimulacionEstado obtenerMapaSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);

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

    public synchronized Vuelo obtenerVueloSimulado(Integer idSimulacion, Integer idVuelo) {
        validarSimulacionSolicitada(idSimulacion);

        Vuelo vuelo = vuelosSimulados.get(idVuelo);
        if (vuelo == null) {
            throw new IllegalArgumentException("No existe un vuelo simulado con id " + idVuelo + ".");
        }

        return vuelo;
    }

    public synchronized List<Vuelo> listarVuelosSimuladosPorAeropuerto(
            Integer idSimulacion,
            String codigoAeropuerto
    ) {
        validarSimulacionSolicitada(idSimulacion);

        return vuelosSimulados.values().stream()
                .filter(vuelo ->
                        vuelo.getDesde() != null
                                && vuelo.getHasta() != null
                                && (
                                codigoAeropuerto.equalsIgnoreCase(vuelo.getDesde().getCodigo())
                                        || codigoAeropuerto.equalsIgnoreCase(vuelo.getHasta().getCodigo())
                        )
                )
                .sorted((a, b) -> Integer.compare(
                        a.getIdVuelo() != null ? a.getIdVuelo() : 0,
                        b.getIdVuelo() != null ? b.getIdVuelo() : 0
                ))
                .collect(Collectors.toList());
    }

    public synchronized boolean estaVueloSimuladoCancelado(
            Integer idSimulacion,
            Integer idVuelo,
            int salidaMinuto
    ) {
        validarSimulacionSolicitada(idSimulacion);
        return cancelacionesVuelosSimulados.containsKey(new ClaveVueloSimulado(
                idVuelo,
                salidaMinuto
        ));
    }

    public synchronized void cancelarVueloSimulado(
            Integer idSimulacion,
            Integer idVuelo,
            int salidaMinuto
    ) {
        validarSimulacionSolicitada(idSimulacion);

        if (idVuelo == null || !vuelosSimulados.containsKey(idVuelo)) {
            throw new IllegalArgumentException("No existe un vuelo simulado con codigo " + idVuelo + ".");
        }

        int minutoCancelacion = obtenerMinutoReferenciaMapa();
        int salidaCancelable = resolverSalidaCancelableSimulada(salidaMinuto, minutoCancelacion);

        ClaveVueloSimulado clave = new ClaveVueloSimulado(idVuelo, salidaCancelable);
        if (cancelacionesVuelosSimulados.containsKey(clave)) {
            return;
        }

        CancelacionVueloSimulada cancelacion = new CancelacionVueloSimulada(
                idVuelo,
                salidaCancelable,
                minutoCancelacion
        );
        cancelacionesVuelosSimulados.put(clave, cancelacion);
        replanificarEnviosAfectadosPorCancelacion(cancelacion);
    }

    private int resolverSalidaCancelableSimulada(int salidaMinuto, int minutoReferencia) {
        int salidaCancelable = salidaMinuto;
        while (salidaCancelable - minutoReferencia < VueloCancelacionService.MINUTOS_AVISO_MIN) {
            salidaCancelable += VueloCancelacionService.MINUTOS_DIA;
        }

        return salidaCancelable;
    }

    public synchronized boolean estaVueloSimuladoCanceladoEnDia(
            Integer idSimulacion,
            Integer idVuelo,
            int minutoReferencia
    ) {
        validarSimulacionSolicitada(idSimulacion);
        int dia = Math.floorDiv(Math.max(0, minutoReferencia), VueloCancelacionService.MINUTOS_DIA);
        int inicioDia = dia * VueloCancelacionService.MINUTOS_DIA;
        int finDia = inicioDia + VueloCancelacionService.MINUTOS_DIA;

        return cancelacionesVuelosSimulados.values().stream()
                .anyMatch(cancelacion -> cancelacion.idVuelo().equals(idVuelo)
                        && (
                        (cancelacion.salidaMinuto() >= inicioDia && cancelacion.salidaMinuto() < finDia)
                                || (cancelacion.cancelacionMinuto() >= inicioDia
                                && cancelacion.cancelacionMinuto() < finDia)
                ));
    }

    @Scheduled(fixedRate = INTERVALO_VERIFICACION_MS)
    @Transactional
    public synchronized void procesarSiguienteBloqueProgramado() {
        if (!simulacionActiva || procesandoBloque) {
            return;
        }

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
        aplicarCancelacionesSimuladas(inicioVentana, finVentana);

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

        if (indiceSiguienteSolicitud >= solicitudesPendientes.size()
                || punteroConsumoMinutos > ultimoMinutoSimulacion) {
            finalizarSimulacion();
        }
    }

    private void procesarSolicitudSimulada(SolicitudEnvio solicitud) {
        metricas.incrementarTotalConsumidas();

        solicitud.setSimulacion(simulacionActual);
        solicitud.setEstado(EstadoEnvio.INGRESADO);
        SolicitudEnvio solicitudGuardada = solicitudEnvioRepository.save(solicitud);
        int minutoSolicitud = calcularMinutoSimulacion(solicitudGuardada, fechaHoraInicioSimulacion);
        actualizarReservasSimuladas(minutoSolicitud);

        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitudGuardada.getOrigen().getCodigo());

        if (origenSimulado == null || !origenSimulado.tieneCapacidad(solicitudGuardada.getContarBolsas())) {
            metricas.incrementarNoResueltasPorAlmacenOrigen();
            return;
        }

        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
        solicitudEnvioRepository.save(solicitudGuardada);

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
            metricas.registrarRutaResuelta(mejorRutaSimulada.getCosto(), mejorRutaSimulada.getVuelos().size());
            return;
        }

        List<AsignacionSimulada> asignaciones = planificarSolicitudSimuladaDividida(
                solicitudGuardada,
                minutoSolicitud
        );

        if (asignaciones.isEmpty()) {
            metricas.incrementarNoResueltasPorRutaVueloPlazo();

            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(solicitudGuardada);
            return;
        }

        guardarAsignacionesSimuladas(solicitudGuardada, asignaciones, minutoSolicitud);

        int cantidadVuelos = asignaciones.stream()
                .mapToInt(asignacion -> asignacion.ruta().getVuelos().size())
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
        vuelosSimulados.clear();
        reservasVuelosSimulados.clear();
        reservasAlmacenesSimulados.clear();
        cancelacionesVuelosSimulados.clear();

        for (Aeropuerto aeropuertoReal : aeropuertoRepository.findAll()) {
            Aeropuerto aeropuertoClonado = clonarAeropuerto(aeropuertoReal);
            aeropuertosSimulados.put(aeropuertoClonado.getCodigo(), aeropuertoClonado);
        }

        for (Vuelo vueloReal : vueloRepository.findByCancelado(false)) {
            Vuelo vueloClonado = clonarVuelo(vueloReal);
            vuelosSimulados.put(vueloClonado.getIdVuelo(), vueloClonado);
        }

        this.planificadorGA = null;
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
        vueloClonado.setCapacidadUsada(0);
        vueloClonado.setCancelado(vueloReal.getCancelado());

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

            int capacidadRuta = calcularCapacidadDisponibleRuta(ruta);
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

        asignacionEnvioRepository.deleteByEnvio_IdEnvio(solicitud.getIdEnvio());

        Ruta rutaPrincipal = null;
        for (AsignacionSimulada asignacion : asignaciones) {
            if (!asignacion.reservasRegistradas()) {
                List<ReservaVueloSimulado> reservasRuta = calcularReservasRuta(
                        asignacion.ruta(),
                        minutoReferencia,
                        solicitud.getIdEnvio(),
                        asignacion.bolsas()
                );
                registrarReservasRuta(
                        solicitud.getIdEnvio(),
                        solicitud.getOrigen().getCodigo(),
                        asignacion.bolsas(),
                        reservasRuta,
                        minutoReferencia
                );
            }

            Ruta rutaGuardada = rutaRepository.save(convertirRutaPersistible(asignacion.ruta()));
            if (rutaPrincipal == null) {
                rutaPrincipal = rutaGuardada;
            }

            asignacionEnvioRepository.save(new AsignacionEnvio(
                    solicitud,
                    rutaGuardada,
                    asignacion.bolsas(),
                    EstadoEnvio.EN_PROCESO
            ));
        }

        solicitud.setRuta(rutaPrincipal);
        solicitud.setEstado(totalAsignado >= solicitud.getContarBolsas()
                ? EstadoEnvio.EN_PROCESO
                : EstadoEnvio.PARCIAL);

        return solicitudEnvioRepository.save(solicitud);
    }

    private int calcularCapacidadDisponibleRuta(Ruta ruta) {
        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return 0;
        }

        int capacidad = Integer.MAX_VALUE;
        for (Vuelo vuelo : ruta.getVuelos()) {
            capacidad = Math.min(capacidad, vuelo.getCapacidadDisponible());
        }

        return capacidad == Integer.MAX_VALUE ? 0 : capacidad;
    }

    private Ruta convertirRutaPersistible(Ruta rutaSimulada) {
        Ruta rutaPersistible = new Ruta();
        rutaPersistible.setTiempoTotal(rutaSimulada.getTiempoTotal());
        rutaPersistible.setCosto(rutaSimulada.getCosto());
        rutaPersistible.setFactible(rutaSimulada.getFactible());

        List<Vuelo> vuelosPersistibles = new ArrayList<>();
        for (Vuelo vueloSimulado : rutaSimulada.getVuelos()) {
            vuelosPersistibles.add(vueloRepository.getReferenceById(vueloSimulado.getIdVuelo()));
        }

        rutaPersistible.setVuelos(vuelosPersistibles);
        return rutaPersistible;
    }

    private SolicitudEnvio clonarSolicitudConRutaSimulada(SolicitudEnvio original) {
        Ruta rutaSimulada = clonarRutaConVuelosSimulados(original.getRuta());

        return new SolicitudEnvio(
                original.getIdEnvio(),
                original.getFecha(),
                original.getHora(),
                original.getIdCliente(),
                rutaSimulada,
                original.getSimulacion(),
                original.getOrigen(),
                original.getDestino(),
                original.getContarBolsas(),
                original.getDiasTiempoMaximo(),
                original.getEstado()
        );
    }

    private Ruta clonarRutaConVuelosSimulados(Ruta original) {
        if (original == null) {
            return null;
        }

        Ruta rutaClonada = new Ruta();
        rutaClonada.setIdRuta(original.getIdRuta());
        rutaClonada.setTiempoTotal(original.getTiempoTotal());
        rutaClonada.setCosto(original.getCosto());
        rutaClonada.setFactible(original.getFactible());

        List<Vuelo> vuelosClonados = new ArrayList<>();
        if (original.getVuelos() != null) {
            for (Vuelo vueloOriginal : original.getVuelos()) {
                Vuelo vueloSimulado = vuelosSimulados.get(vueloOriginal.getIdVuelo());
                vuelosClonados.add(clonarVuelo(vueloSimulado != null ? vueloSimulado : vueloOriginal));
            }
        }

        rutaClonada.setVuelos(vuelosClonados);
        return rutaClonada;
    }

    private List<SolicitudEnvio> adjuntarAsignaciones(
            List<SolicitudEnvio> envios,
            boolean usarVuelosSimulados
    ) {
        if (envios == null || envios.isEmpty()) {
            return envios;
        }

        List<Integer> idsEnvio = envios.stream()
                .map(SolicitudEnvio::getIdEnvio)
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<Integer, List<SolicitudEnvio.AsignacionEnvioVista>> asignacionesPorEnvio = new HashMap<>();

        if (!idsEnvio.isEmpty()) {
            for (AsignacionEnvio asignacion : asignacionEnvioRepository.findByEnvioIds(idsEnvio)) {
                if (asignacion.getEnvio() == null || asignacion.getEnvio().getIdEnvio() == null) {
                    continue;
                }

                Ruta ruta = usarVuelosSimulados
                        ? clonarRutaConVuelosSimulados(asignacion.getRuta())
                        : asignacion.getRuta();

                asignacionesPorEnvio
                        .computeIfAbsent(asignacion.getEnvio().getIdEnvio(), ignored -> new ArrayList<>())
                        .add(new SolicitudEnvio.AsignacionEnvioVista(
                                asignacion.getIdAsignacion(),
                                ruta,
                                asignacion.getCantidadBolsas(),
                                asignacion.getEstado()
                        ));
            }
        }

        for (SolicitudEnvio envio : envios) {
            envio.setAsignaciones(asignacionesPorEnvio.getOrDefault(
                    envio.getIdEnvio(),
                    List.of()
            ));
        }

        return envios;
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
                    : LocalDateTime.now());
            this.simulacionActual.setCancelacionesVuelos(cancelacionesVuelosSimulados.size());
            this.simulacionActual.setDuracionSimulacionMinutos(duracionFinalMinutos);
            simulacionRepository.save(this.simulacionActual);
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
            for (Aeropuerto aeropuerto : aeropuertosSimulados.values()) {
                double porcentaje = calcularOcupacionPorcentaje(
                        aeropuerto.getCapacidad(),
                        aeropuertoRepository.findByCodigo(aeropuerto.getCodigo())
                                .map(Aeropuerto::getCapacidad)
                                .orElse(aeropuerto.getCapacidad())
                );
                ocupacion.put(aeropuerto.getCodigo(), porcentaje);
            }
            return ocupacion;
        }

        for (Aeropuerto aeropuerto : aeropuertoRepository.findAll()) {
            ocupacion.put(aeropuerto.getCodigo(), 0.0);
        }

        return ocupacion;
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
        if (punteroConsumoMinutos == null || vuelosSimulados.isEmpty()) {
            return List.of();
        }

        int minutoReferencia = obtenerMinutoReferenciaMapa();
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = new ArrayList<>();

        for (Vuelo vuelo : vuelosSimulados.values()) {
            if (vuelo.getIdVuelo() == null
                    || vuelo.getDesde() == null
                    || vuelo.getDesde().getCodigo() == null
                    || vuelo.getHasta() == null
                    || vuelo.getHasta().getCodigo() == null) {
                continue;
            }

            VentanaVueloSimulada ventana = calcularVentanaActivaVuelo(vuelo, minutoReferencia);
            if (ventana == null || cancelacionesVuelosSimulados.containsKey(new ClaveVueloSimulado(
                    vuelo.getIdVuelo(),
                    ventana.salidaMinuto()
            ))) {
                continue;
            }

            int capacidad = vuelo.getCapacidad() != null ? vuelo.getCapacidad() : 0;
            int bolsasActivas = reservasVuelosSimulados
                    .getOrDefault(vuelo.getIdVuelo(), List.of())
                    .stream()
                    .filter(reserva -> reserva.salidaMinuto() == ventana.salidaMinuto())
                    .filter(reserva -> reserva.llegadaMinuto() == ventana.llegadaMinuto())
                    .mapToInt(ReservaVueloSimulado::bolsas)
                    .sum();
            double occupancyPct = capacidad <= 0
                    ? 0.0
                    : Math.min(100.0, (bolsasActivas * 100.0) / capacidad);
            double progress = Math.max(
                    0.001,
                    Math.min(
                            0.999,
                            (minutoReferencia - ventana.salidaMinuto())
                                    / (double) ventana.durationMinutes()
                    )
            );

            vuelosMapa.add(new MapaSimulacionEstado.VueloMapa(
                    "sim-vuelo-" + vuelo.getIdVuelo() + "-" + ventana.salidaMinuto(),
                    String.valueOf(vuelo.getIdVuelo()),
                    vuelo.getDesde().getCodigo(),
                    vuelo.getHasta().getCodigo(),
                    progress,
                    occupancyPct,
                    ventana.salidaMinuto(),
                    ventana.llegadaMinuto(),
                    ventana.durationMinutes()
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
                ChronoUnit.MILLIS.between(fechaHoraInicioReal, LocalDateTime.now())
        );
        long minutoVisual = (realMs * scMinutos) / intervaloRealActualMs;
        int referencia = (int) Math.min(Integer.MAX_VALUE, minutoVisual);

        if (ultimoMinutoSimulacion != null) {
            referencia = Math.min(referencia, Math.max(fallback, ultimoMinutoSimulacion));
        }

        return Math.max(fallback, referencia);
    }

    private VentanaVueloSimulada calcularVentanaActivaVuelo(Vuelo vuelo, int minutoReferencia) {
        int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegadaBase = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salidaBase;

        while (llegadaBase <= salidaBase) {
            llegadaBase += VueloCancelacionService.MINUTOS_DIA;
        }

        int durationMinutes = Math.max(1, llegadaBase - salidaBase);
        int diaReferencia = Math.floorDiv(Math.max(0, minutoReferencia), VueloCancelacionService.MINUTOS_DIA);
        int salida = salidaBase + diaReferencia * VueloCancelacionService.MINUTOS_DIA;
        int llegada = salida + durationMinutes;

        while (salida > minutoReferencia && salida - VueloCancelacionService.MINUTOS_DIA >= 0) {
            salida -= VueloCancelacionService.MINUTOS_DIA;
            llegada -= VueloCancelacionService.MINUTOS_DIA;
        }

        while (llegada <= minutoReferencia) {
            salida += VueloCancelacionService.MINUTOS_DIA;
            llegada += VueloCancelacionService.MINUTOS_DIA;
        }

        if (salida <= minutoReferencia && minutoReferencia < llegada) {
            return new VentanaVueloSimulada(salida, llegada, durationMinutes);
        }

        return null;
    }

    private List<MapaSimulacionEstado.CancelacionVueloMapa> construirCancelacionesRecientesMapa() {
        if (punteroConsumoMinutos == null || cancelacionesVuelosSimulados.isEmpty()) {
            return List.of();
        }

        int ventanaMinutos = Math.max(
                VENTANA_CANCELACIONES_MAPA_MIN,
                scMinutos != null ? scMinutos * 2 : 0
        );
        int desdeMinuto = Math.max(0, punteroConsumoMinutos - ventanaMinutos);

        return cancelacionesVuelosSimulados.values().stream()
                .filter(cancelacion -> cancelacion.cancelacionMinuto() >= desdeMinuto)
                .filter(cancelacion -> cancelacion.cancelacionMinuto() <= punteroConsumoMinutos)
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
                            String.valueOf(cancelacion.idVuelo())
                    );
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private PlanificadorGenetico crearPlanificador(Grafo grafo) {
        return new PlanificadorGenetico(
                grafo,
                TAMANO_POBLACION,
                GENERACIONES,
                TASA_CRUZAMIENTO,
                TASA_MUTACION,
                TAMANO_TORNEO,
                ESCALAS_INTERMEDIAS_MAX
        );
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
                minutoInicio,
                this::estaOcurrenciaSimuladaDisponible
        );
    }

    private Grafo construirGrafoSimulado() {
        Grafo grafo = new Grafo();

        for (Aeropuerto aeropuerto : aeropuertosSimulados.values()) {
            grafo.agregarAeropuerto(aeropuerto);
        }

        for (Vuelo vuelo : vuelosSimulados.values()) {
            grafo.agregarVuelo(vuelo);
        }

        return grafo;
    }

    private boolean estaOcurrenciaSimuladaDisponible(Vuelo vuelo, int salidaMinuto) {
        return !cancelacionesVuelosSimulados.containsKey(new ClaveVueloSimulado(
                vuelo.getIdVuelo(),
                salidaMinuto
        ));
    }

    private void actualizarReservasSimuladas(int minutoSimulacion) {
        liberarReservasAlmacen(minutoSimulacion);
        liberarReservasVuelos(minutoSimulacion);
        reconstruirCapacidadVuelosDesdeReservas(minutoSimulacion);
    }

    private void aplicarCancelacionesSimuladas(int inicioVentana, int finVentana) {
        if (vuelosSimulados.isEmpty()) {
            return;
        }

        int diaInicio = Math.floorDiv(Math.max(0, inicioVentana - VueloCancelacionService.MINUTOS_AVISO_MAX),
                VueloCancelacionService.MINUTOS_DIA) - 1;
        int diaFin = Math.floorDiv(finVentana + VueloCancelacionService.MINUTOS_AVISO_MAX,
                VueloCancelacionService.MINUTOS_DIA) + 1;

        for (Vuelo vuelo : vuelosSimulados.values()) {
            int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;

            for (int dia = Math.max(0, diaInicio); dia <= diaFin; dia++) {
                int salidaMinuto = salidaBase + dia * VueloCancelacionService.MINUTOS_DIA;
                ClaveVueloSimulado clave = new ClaveVueloSimulado(vuelo.getIdVuelo(), salidaMinuto);

                if (cancelacionesVuelosSimulados.containsKey(clave)
                        || !vueloCancelacionService.debeCancelar(vuelo, salidaMinuto)) {
                    continue;
                }

                int cancelacionMinuto = vueloCancelacionService.calcularMinutoCancelacionSimulada(vuelo, salidaMinuto);
                if (cancelacionMinuto < inicioVentana || cancelacionMinuto >= finVentana) {
                    continue;
                }

                CancelacionVueloSimulada cancelacion = new CancelacionVueloSimulada(
                        vuelo.getIdVuelo(),
                        salidaMinuto,
                        cancelacionMinuto
                );
                cancelacionesVuelosSimulados.put(clave, cancelacion);
                replanificarEnviosAfectadosPorCancelacion(cancelacion);
            }
        }
    }

    private void replanificarEnviosAfectadosPorCancelacion(CancelacionVueloSimulada cancelacion) {
        List<Integer> enviosAfectados = reservasVuelosSimulados
                .getOrDefault(cancelacion.idVuelo(), List.of())
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
        SolicitudEnvio envio = solicitudEnvioRepository.findById(idEnvio).orElse(null);
        if (envio == null || envio.getEstado() == EstadoEnvio.COMPLETADO) {
            return;
        }

        liberarReservasEnvioSimulado(envio, minutoReplanificacion);
        actualizarReservasSimuladas(minutoReplanificacion);
        asignacionEnvioRepository.deleteByEnvio_IdEnvio(envio.getIdEnvio());

        Aeropuerto origenSimulado = aeropuertosSimulados.get(envio.getOrigen().getCodigo());
        if (origenSimulado == null || !origenSimulado.tieneCapacidad(envio.getContarBolsas())) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(envio);
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
            return;
        }

        List<AsignacionSimulada> asignaciones = planificarSolicitudSimuladaDividida(
                envio,
                minutoReplanificacion
        );

        if (asignaciones.isEmpty()) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(envio);
            return;
        }

        guardarAsignacionesSimuladas(envio, asignaciones, minutoReplanificacion);
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
            int capacidadBase = aeropuertoRepository.findByCodigo(aeropuerto.getCodigo())
                    .map(Aeropuerto::getCapacidad)
                    .orElse(capacidadActual + deltaCapacidad);
            aeropuerto.setCapacidad(Math.min(capacidadBase, capacidadActual + deltaCapacidad));
            return;
        }

        aeropuerto.setCapacidad(Math.max(0, capacidadActual + deltaCapacidad));
    }

    private void liberarReservasVuelos(int minutoSimulacion) {
        Iterator<Map.Entry<Integer, List<ReservaVueloSimulado>>> iterator = reservasVuelosSimulados.entrySet().iterator();

        while (iterator.hasNext()) {
            Map.Entry<Integer, List<ReservaVueloSimulado>> entry = iterator.next();
            entry.getValue().removeIf(reserva -> reserva.llegadaMinuto() <= minutoSimulacion);

            if (entry.getValue().isEmpty()) {
                iterator.remove();
            }
        }
    }

    private void reconstruirCapacidadVuelosDesdeReservas(int minutoSimulacion) {
        for (Vuelo vuelo : vuelosSimulados.values()) {
            vuelo.setCapacidadUsada(0);
            vuelo.setBloqueadoPorVueloActivo(false);
        }

        for (Map.Entry<Integer, List<ReservaVueloSimulado>> entry : reservasVuelosSimulados.entrySet()) {
            Vuelo vuelo = vuelosSimulados.get(entry.getKey());
            if (vuelo == null) {
                continue;
            }

            boolean enVuelo = entry.getValue().stream()
                    .anyMatch(reserva -> reserva.salidaMinuto() <= minutoSimulacion
                            && reserva.llegadaMinuto() > minutoSimulacion);

            int capacidadEnVuelo = entry.getValue().stream()
                    .filter(reserva -> reserva.salidaMinuto() <= minutoSimulacion
                            && reserva.llegadaMinuto() > minutoSimulacion)
                    .mapToInt(ReservaVueloSimulado::bolsas)
                    .sum();

            if (enVuelo) {
                vuelo.setBloqueadoPorVueloActivo(true);
                vuelo.setCapacidadUsada(Math.min(vuelo.getCapacidad(), capacidadEnVuelo));
                continue;
            }

            int capacidadReservada = entry.getValue().stream()
                    .mapToInt(ReservaVueloSimulado::bolsas)
                    .sum();
            vuelo.setCapacidadUsada(Math.min(vuelo.getCapacidad(), capacidadReservada));
        }
    }

    private List<ReservaVueloSimulado> calcularReservasRuta(
            Ruta ruta,
            int minutoInicio,
            Integer idEnvio,
            int bolsas
    ) {
        List<ReservaVueloSimulado> reservas = new ArrayList<>();

        if (ruta == null || ruta.getVuelos() == null) {
            return reservas;
        }

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

            reservas.add(new ReservaVueloSimulado(
                    idEnvio,
                    vuelo.getIdVuelo(),
                    bolsas,
                    salida,
                    llegada
            ));
            minutoReferencia = llegada;
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
            reservasVuelosSimulados.computeIfAbsent(reserva.idVuelo(), ignored -> new ArrayList<>())
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
            Integer idVuelo,
            int bolsas,
            int salidaMinuto,
            int llegadaMinuto
    ) {
    }

    private record VentanaVueloSimulada(
            int salidaMinuto,
            int llegadaMinuto,
            int durationMinutes
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

    private record ClaveVueloSimulado(
            Integer idVuelo,
            int salidaMinuto
    ) {
    }

    private record CancelacionVueloSimulada(
            Integer idVuelo,
            int salidaMinuto,
            int cancelacionMinuto
    ) {
    }
}
