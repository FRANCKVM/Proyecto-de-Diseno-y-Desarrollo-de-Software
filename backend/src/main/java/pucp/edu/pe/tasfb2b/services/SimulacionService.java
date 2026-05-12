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
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SimulacionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SimulacionService.class);

    private static final int SA_MINUTOS = 5;// bloque en minutos debe multiplicarse por k
    private static final long INTERVALO_REAL_MS = 30000;//tiempo de espera entre ejecucion

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
    private final ObjectMapper objectMapper;

    private boolean simulacionActiva = false;
    private boolean procesandoBloque = false;

    private Integer kActual;
    private Integer scMinutos;
    private Integer punteroConsumoMinutos;
    private Integer ultimoMinutoSimulacion;

    private LocalDateTime fechaHoraInicioSimulacion;
    private List<SolicitudEnvio> solicitudesPendientes = new ArrayList<>();
    private PlanificadorGenetico planificadorGA;
    private final SimulacionMetricas metricas = new SimulacionMetricas();

    private final Map<String, Aeropuerto> aeropuertosSimulados = new HashMap<>();
    private final Map<Integer, Vuelo> vuelosSimulados = new HashMap<>();
    private Simulacion simulacionActual;
    private Integer ultimoIdSimulacion;
    private int indiceSiguienteSolicitud = 0;

    public SimulacionService(
            SimulacionCargaService simulacionCargaService,
            SimulacionEstadoService simulacionEstadoService,
            AeropuertoRepository aeropuertoRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            RutaRepository rutaRepository,
            SimulacionRepository simulacionRepository,
            VueloRepository vueloRepository,
            ObjectMapper objectMapper
    ) {
        this.simulacionCargaService = simulacionCargaService;
        this.simulacionEstadoService = simulacionEstadoService;
        this.aeropuertoRepository = aeropuertoRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.rutaRepository = rutaRepository;
        this.simulacionRepository = simulacionRepository;
        this.vueloRepository = vueloRepository;
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
        return solicitudEnvioRepository.findBySimulacion_IdSimulacionOrderByIdEnvioAsc(idSimulacion);
    }

    public synchronized MapaSimulacionEstado obtenerMapaSimulacion(Integer idSimulacion) {
        validarSimulacionSolicitada(idSimulacion);

        Map<String, Double> ocupacionPorAeropuerto = construirOcupacionPorAeropuerto(idSimulacion);
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = construirVuelosMapa(idSimulacion);

        return new MapaSimulacionEstado(idSimulacion, ocupacionPorAeropuerto, vuelosMapa);
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

        Aeropuerto origenSimulado = aeropuertosSimulados.get(solicitudGuardada.getOrigen().getCodigo());

        if (origenSimulado == null || !origenSimulado.tieneCapacidad(solicitudGuardada.getContarBolsas())) {
            metricas.incrementarNoResueltasPorAlmacenOrigen();
            return;
        }

        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
        solicitudEnvioRepository.save(solicitudGuardada);

        SolicitudEnvio solicitudSimulada = construirSolicitudSimulada(solicitudGuardada);

        long inicioPlanificacion = System.nanoTime();
        Ruta mejorRutaSimulada = planificadorGA.encontrarMejorRuta(solicitudSimulada);
        long finPlanificacion = System.nanoTime();

        metricas.registrarTiempoPlanificacion(finPlanificacion - inicioPlanificacion);

        if (mejorRutaSimulada != null && mejorRutaSimulada.esFactible()) {
            origenSimulado.descontarCapacidad(solicitudGuardada.getContarBolsas());
            mejorRutaSimulada.reservarCapacidad(solicitudGuardada.getContarBolsas());

            Ruta rutaGuardada = rutaRepository.save(convertirRutaPersistible(mejorRutaSimulada));

            solicitudGuardada.setRuta(rutaGuardada);
            solicitudGuardada.setEstado(EstadoEnvio.COMPLETADO);
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

        for (Aeropuerto aeropuertoReal : aeropuertoRepository.findAll()) {
            Aeropuerto aeropuertoClonado = clonarAeropuerto(aeropuertoReal);
            aeropuertosSimulados.put(aeropuertoClonado.getCodigo(), aeropuertoClonado);
        }

        for (Vuelo vueloReal : vueloRepository.findByCancelado(false)) {
            Vuelo vueloClonado = clonarVuelo(vueloReal);
            vuelosSimulados.put(vueloClonado.getIdVuelo(), vueloClonado);
        }

        Grafo grafoSimulado = new Grafo();

        for (Aeropuerto aeropuerto : aeropuertosSimulados.values()) {
            grafoSimulado.agregarAeropuerto(aeropuerto);
        }

        for (Vuelo vuelo : vuelosSimulados.values()) {
            grafoSimulado.agregarVuelo(vuelo);
        }

        this.planificadorGA = crearPlanificador(grafoSimulado);
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
        vueloClonado.setCapacidadUsada(vueloReal.getCapacidadUsada());
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
        this.fechaHoraInicioSimulacion = null;
        this.aeropuertosSimulados.clear();
        this.vuelosSimulados.clear();
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
}
