package pucp.edu.pe.tasfb2b.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
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
import java.util.stream.Collectors;

@Service
public class SimulacionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SimulacionService.class);

    private static final int SA_MINUTOS = 5;// bloque en minutos debe multiplicarse por k
    private static final long INTERVALO_REAL_MS = 60000;//tiempo de espera entre ejecucion

    private static final int TAMANO_POBLACION = 30;
    private static final int GENERACIONES = 60;
    private static final double TASA_CRUZAMIENTO = 0.85;
    private static final double TASA_MUTACION = 0.25;
    private static final int TAMANO_TORNEO = 3;
    private static final int ESCALAS_INTERMEDIAS_MAX = 4;

    private final SimulacionCargaService simulacionCargaService;
    private final SimulacionEstadoService simulacionEstadoService;
    private final AeropuertoRepository aeropuertoRepository;
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
    private Integer punteroConsumoMinutos;
    private Integer ultimoMinutoSimulacion;

    private LocalDateTime fechaHoraInicioReal;
    private LocalDateTime fechaHoraInicioSimulacion;
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
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.rutaRepository = rutaRepository;
        this.simulacionRepository = simulacionRepository;
        this.vueloRepository = vueloRepository;
        this.vueloCancelacionService = vueloCancelacionService;
        this.objectMapper = objectMapper;
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
        this.punteroConsumoMinutos = 0;
        this.indiceSiguienteSolicitud = 0;
        this.reservasVuelosSimulados.clear();
        this.reservasAlmacenesSimulados.clear();
        this.cancelacionesVuelosSimulados.clear();
        this.fechaHoraInicioReal = LocalDateTime.now();
        this.fechaHoraInicioSimulacion = fechaHoraInicio;

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

        this.simulacionActual = simulacionRepository.save(
                new Simulacion(k, fechaHoraInicioSimulacion, true)
        );
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
            return envios;
        }

        return envios.stream()
                .map(this::clonarSolicitudConRutaSimulada)
                .collect(Collectors.toList());
    }

    public synchronized MapaSimulacionEstado obtenerMapaSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);

        Map<String, Double> ocupacionPorAeropuerto = construirOcupacionPorAeropuerto(idSimulacion);
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = construirVuelosMapa(idSimulacion);

        return new MapaSimulacionEstado(idSimulacion, ocupacionPorAeropuerto, vuelosMapa);
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

    @Scheduled(fixedRate = INTERVALO_REAL_MS)
    @Transactional
    public synchronized void procesarSiguienteBloqueProgramado() {
        if (!simulacionActiva || procesandoBloque) {
            return;
        }

        try {
            procesandoBloque = true;
            procesarSiguienteBloque();
        } finally {
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

        SolicitudEnvio solicitudSimulada = construirSolicitudSimulada(solicitudGuardada);

        long inicioPlanificacion = System.nanoTime();
        Ruta mejorRutaSimulada = crearPlanificadorSimulado(minutoSolicitud).encontrarMejorRuta(solicitudSimulada);
        long finPlanificacion = System.nanoTime();

        metricas.registrarTiempoPlanificacion(finPlanificacion - inicioPlanificacion);

        if (mejorRutaSimulada != null && mejorRutaSimulada.esFactible()) {
            origenSimulado.descontarCapacidad(solicitudGuardada.getContarBolsas());
            List<ReservaVueloSimulado> reservasRuta = calcularReservasRuta(
                    mejorRutaSimulada,
                    minutoSolicitud,
                    solicitudGuardada.getIdEnvio(),
                    solicitudGuardada.getContarBolsas()
            );
            registrarReservasRuta(
                    solicitudGuardada.getIdEnvio(),
                    solicitudGuardada.getOrigen().getCodigo(),
                    solicitudGuardada.getContarBolsas(),
                    reservasRuta,
                    minutoSolicitud
            );

            Ruta rutaGuardada = rutaRepository.save(convertirRutaPersistible(mejorRutaSimulada));

            solicitudGuardada.setRuta(rutaGuardada);
            solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
            solicitudEnvioRepository.save(solicitudGuardada);

            int cantidadVuelos = mejorRutaSimulada.getVuelos().size();
            metricas.registrarRutaResuelta(mejorRutaSimulada.getCosto(), cantidadVuelos);
        } else {
            metricas.incrementarNoResueltasPorRutaVueloPlazo();

            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(solicitudGuardada);
        }
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
        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitudReal.getOrigen().getCodigo());
        Aeropuerto destinoSimulado = aeropuertosSimulados.get(solicitudReal.getDestino().getCodigo());

        return new SolicitudEnvio(
                solicitudReal.getIdEnvio(),
                solicitudReal.getFecha(),
                solicitudReal.getHora(),
                solicitudReal.getIdCliente(),
                origenSimulado,
                destinoSimulado,
                solicitudReal.getContarBolsas(),
                solicitudReal.getDiasTiempoMaximo()
        );
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

    private void finalizarSimulacion() {
        Integer idSimulacionFinal = simulacionActual != null
                ? simulacionActual.getIdSimulacion()
                : ultimoIdSimulacion;

        if (this.simulacionActual != null) {
            this.simulacionActual.setActiva(false);
            this.simulacionActual.setFechaFin(LocalDateTime.now());
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
        this.simulacionActual = null;
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
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = new ArrayList<>();
        List<SolicitudEnvio> solicitudes = solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);

        for (SolicitudEnvio solicitud : solicitudes) {
            if (solicitud.getRuta() == null || solicitud.getRuta().getVuelos() == null) {
                continue;
            }

            int indice = 0;
            for (Vuelo vuelo : solicitud.getRuta().getVuelos()) {
                vuelosMapa.add(new MapaSimulacionEstado.VueloMapa(
                        "sim-" + solicitud.getIdEnvio() + "-vuelo-" + vuelo.getIdVuelo() + "-" + indice,
                        vuelo.getDesde().getCodigo(),
                        vuelo.getHasta().getCodigo(),
                        solicitud.getEstado() == EstadoEnvio.COMPLETADO ? 0.5 : 0.0
                ));
                indice++;
            }
        }

        return vuelosMapa;
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
        if (envio == null || envio.getRuta() == null || envio.getEstado() == EstadoEnvio.COMPLETADO) {
            return;
        }

        liberarReservasEnvioSimulado(envio, minutoReplanificacion);
        actualizarReservasSimuladas(minutoReplanificacion);

        Aeropuerto origenSimulado = aeropuertosSimulados.get(envio.getOrigen().getCodigo());
        if (origenSimulado == null || !origenSimulado.tieneCapacidad(envio.getContarBolsas())) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(envio);
            return;
        }

        SolicitudEnvio solicitudSimulada = construirSolicitudSimulada(envio);
        Ruta rutaReplanificada = crearPlanificadorSimulado(minutoReplanificacion).encontrarMejorRuta(solicitudSimulada);

        if (rutaReplanificada == null || !rutaReplanificada.esFactible()) {
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(envio);
            return;
        }

        origenSimulado.descontarCapacidad(envio.getContarBolsas());
        List<ReservaVueloSimulado> nuevasReservas = calcularReservasRuta(
                rutaReplanificada,
                minutoReplanificacion,
                envio.getIdEnvio(),
                envio.getContarBolsas()
        );
        registrarReservasRuta(
                envio.getIdEnvio(),
                envio.getOrigen().getCodigo(),
                envio.getContarBolsas(),
                nuevasReservas,
                minutoReplanificacion
        );

        envio.setRuta(rutaRepository.save(convertirRutaPersistible(rutaReplanificada)));
        envio.setEstado(EstadoEnvio.EN_PROCESO);
        solicitudEnvioRepository.save(envio);
    }

    private void liberarReservasEnvioSimulado(SolicitudEnvio envio, int minutoReferencia) {
        boolean restaurarOrigen = reservasAlmacenesSimulados.stream()
                .anyMatch(reserva -> reserva.idEnvio().equals(envio.getIdEnvio())
                        && reserva.minutoLiberacion() > minutoReferencia);

        reservasAlmacenesSimulados.removeIf(reserva -> reserva.idEnvio().equals(envio.getIdEnvio()));

        for (List<ReservaVueloSimulado> reservas : reservasVuelosSimulados.values()) {
            reservas.removeIf(reserva -> reserva.idEnvio().equals(envio.getIdEnvio()));
        }
        reservasVuelosSimulados.entrySet().removeIf(entry -> entry.getValue().isEmpty());

        if (restaurarOrigen) {
            Aeropuerto origen = aeropuertosSimulados.get(envio.getOrigen().getCodigo());
            if (origen != null) {
                origen.aumentarCapacidad(envio.getContarBolsas());
            }
        }
    }

    private void liberarReservasAlmacen(int minutoSimulacion) {
        Iterator<ReservaAlmacenSimulado> iterator = reservasAlmacenesSimulados.iterator();

        while (iterator.hasNext()) {
            ReservaAlmacenSimulado reserva = iterator.next();

            if (reserva.minutoLiberacion() > minutoSimulacion) {
                continue;
            }

            Aeropuerto aeropuerto = aeropuertosSimulados.get(reserva.codigoAeropuerto());
            if (aeropuerto != null) {
                aeropuerto.aumentarCapacidad(reserva.bolsas());
            }

            iterator.remove();
        }
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

    private record ReservaAlmacenSimulado(
            Integer idEnvio,
            String codigoAeropuerto,
            int bolsas,
            int minutoLiberacion
    ) {
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
