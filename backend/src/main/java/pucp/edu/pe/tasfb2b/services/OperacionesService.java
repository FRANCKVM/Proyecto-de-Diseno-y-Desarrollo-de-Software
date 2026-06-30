package pucp.edu.pe.tasfb2b.services;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.EstadoOperacionResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.RegistrarOperacionEnvioRequest;
import pucp.edu.pe.tasfb2b.algorithms.ga.PlanificadorGenetico;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.AsignacionEnvio;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloCancelacion;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.RutaRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloCancelacionRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Duration;
import java.util.Collections;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class OperacionesService {

    private static final int TAMANO_POBLACION = 30;
    private static final int GENERACIONES = 60;
    private static final double TASA_CRUZAMIENTO = 0.85;
    private static final double TASA_MUTACION = 0.25;
    private static final int TAMANO_TORNEO = 3;
    private static final int ESCALAS_INTERMEDIAS_MAX = 4;
    private static final double PLAZO_INTRACONTINENTAL_DIAS = 1.0;
    private static final double PLAZO_INTERCONTINENTAL_DIAS = 2.0;
    private static final long VENTANA_CANCELACIONES_MAPA_REAL_MIN = 5;

    private final GrafoService grafoService;
    private final AeropuertoRepository aeropuertoRepository;
    private final AsignacionEnvioRepository asignacionEnvioRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final RutaRepository rutaRepository;
    private final VueloRepository vueloRepository;
    private final VueloCancelacionRepository vueloCancelacionRepository;
    private final VueloCancelacionService vueloCancelacionService;
    private final EstadoLogisticoService estadoLogisticoService;

    public OperacionesService(
            GrafoService grafoService,
            AeropuertoRepository aeropuertoRepository,
            AsignacionEnvioRepository asignacionEnvioRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            RutaRepository rutaRepository,
            VueloRepository vueloRepository,
            VueloCancelacionRepository vueloCancelacionRepository,
            VueloCancelacionService vueloCancelacionService,
            EstadoLogisticoService estadoLogisticoService
    ) {
        this.grafoService = grafoService;
        this.aeropuertoRepository = aeropuertoRepository;
        this.asignacionEnvioRepository = asignacionEnvioRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.rutaRepository = rutaRepository;
        this.vueloRepository = vueloRepository;
        this.vueloCancelacionRepository = vueloCancelacionRepository;
        this.vueloCancelacionService = vueloCancelacionService;
        this.estadoLogisticoService = estadoLogisticoService;
    }

    @Transactional
    public List<SolicitudEnvio> procesarBloqueReal(List<SolicitudEnvio> solicitudesEntrantes) {
        if (solicitudesEntrantes == null || solicitudesEntrantes.isEmpty()) {
            throw new IllegalArgumentException("Debe enviar al menos un envio.");
        }

        List<SolicitudEnvio> solicitudes = normalizarSolicitudes(solicitudesEntrantes);
        List<SolicitudEnvio> resultados = new ArrayList<>();

        for (SolicitudEnvio solicitud : solicitudes) {
            resultados.add(procesarSolicitudReal(solicitud));
        }

        return adjuntarAsignaciones(resultados);
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void procesarCancelacionesProgramadasOperacion() {
        LocalDateTime ahora = LocalDateTime.now();
        LocalDate hoy = ahora.toLocalDate();
        List<LocalDate> fechas = List.of(hoy, hoy.plusDays(1));

        for (Vuelo vuelo : vueloRepository.findByCancelado(false)) {
            for (LocalDate fecha : fechas) {
                LocalDateTime fechaHoraSalida = vueloCancelacionService.construirFechaHoraSalida(
                        fecha.atStartOfDay(),
                        vuelo
                );

                if (fechaHoraSalida.isBefore(ahora.plusMinutes(VueloCancelacionService.MINUTOS_AVISO_MIN))
                        || fechaHoraSalida.isAfter(ahora.plusMinutes(VueloCancelacionService.MINUTOS_AVISO_MAX))) {
                    continue;
                }

                long claveSalida = vueloCancelacionService.convertirAClaveMinutos(fechaHoraSalida);
                if (!vueloCancelacionService.debeCancelar(vuelo, claveSalida)) {
                    continue;
                }

                LocalDateTime fechaHoraCancelacion = vueloCancelacionService.calcularFechaHoraCancelacion(
                        vuelo,
                        fechaHoraSalida
                );

                if (fechaHoraCancelacion.isAfter(ahora)
                        || vueloCancelacionRepository.existsByVuelo_IdVueloAndFechaHoraSalida(
                        vuelo.getIdVuelo(),
                        fechaHoraSalida
                )) {
                    continue;
                }

                VueloCancelacion cancelacion = vueloCancelacionRepository.save(new VueloCancelacion(
                        vuelo,
                        fechaHoraSalida,
                        fechaHoraCancelacion,
                        ahora
                ));
                replanificarEnviosAfectadosOperacion(cancelacion);
            }
        }
    }

    @Transactional
    public VueloCancelacion cancelarVueloOperacion(Integer idVuelo, LocalDateTime fechaHoraSalida) {
        if (idVuelo == null) {
            throw new IllegalArgumentException("El codigo del vuelo es obligatorio.");
        }

        if (fechaHoraSalida == null) {
            throw new IllegalArgumentException("La fecha de salida del vuelo es obligatoria.");
        }

        Vuelo vuelo = vueloRepository.findById(idVuelo)
                .orElseThrow(() -> new IllegalArgumentException("No existe un vuelo con codigo " + idVuelo + "."));

        if (vuelo.estaCancelado()) {
            throw new IllegalArgumentException("El vuelo base ya se encuentra cancelado.");
        }

        LocalDateTime ahora = LocalDateTime.now();
        fechaHoraSalida = resolverFechaHoraSalidaCancelable(fechaHoraSalida, ahora);

        VueloCancelacion cancelacionExistente = vueloCancelacionRepository
                .findByVuelo_IdVueloAndFechaHoraSalida(idVuelo, fechaHoraSalida)
                .orElse(null);

        if (cancelacionExistente != null) {
            return cancelacionExistente;
        }

        VueloCancelacion cancelacion = vueloCancelacionRepository.save(new VueloCancelacion(
                vuelo,
                fechaHoraSalida,
                ahora,
                ahora
        ));
        replanificarEnviosAfectadosOperacion(cancelacion);
        return cancelacion;
    }

    private LocalDateTime resolverFechaHoraSalidaCancelable(
            LocalDateTime fechaHoraSalida,
            LocalDateTime ahora
    ) {
        LocalDateTime limiteCancelacion = ahora.plusMinutes(VueloCancelacionService.MINUTOS_AVISO_MIN);
        LocalDateTime fechaCancelable = fechaHoraSalida;

        while (fechaCancelable.isBefore(limiteCancelacion)) {
            fechaCancelable = fechaCancelable.plusDays(1);
        }

        return fechaCancelable;
    }

    @Transactional(readOnly = true)
    public List<SolicitudEnvio> obtenerEnviosOperacion() {
        return adjuntarAsignaciones(
                solicitudEnvioRepository.findBySimulacionIsNullOrderByIdEnvioAsc()
        );
    }

    @Transactional
    public SolicitudEnvio registrarEnvioOperacion(RegistrarOperacionEnvioRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("La solicitud de registro no puede ser null.");
        }

        if (request.origenIcao() == null || request.origenIcao().isBlank()) {
            throw new IllegalArgumentException("Debe indicar el aeropuerto de origen.");
        }

        if (request.destinoIcao() == null || request.destinoIcao().isBlank()) {
            throw new IllegalArgumentException("Debe indicar el aeropuerto de destino.");
        }

        if (request.origenIcao().equalsIgnoreCase(request.destinoIcao())) {
            throw new IllegalArgumentException("El aeropuerto de origen debe ser distinto al destino.");
        }

        Aeropuerto origen = aeropuertoRepository.findByCodigo(request.origenIcao().trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No existe aeropuerto origen: " + request.origenIcao()
                ));

        Aeropuerto destino = aeropuertoRepository.findByCodigo(request.destinoIcao().trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No existe aeropuerto destino: " + request.destinoIcao()
                ));

        SolicitudEnvio solicitud = new SolicitudEnvio(
                null,
                LocalDate.now(),
                LocalTime.now(),
                1,
                origen,
                destino,
                request.contarBolsas(),
                calcularPlazoMaximoDias(origen, destino)
        );

        return adjuntarAsignaciones(procesarBloqueReal(Collections.singletonList(solicitud)).get(0));
    }

    @Transactional(readOnly = true)
    public EstadoOperacionResponse obtenerEstadoOperacion() {
        List<SolicitudEnvio> envios = obtenerEnviosOperacion();
        LocalDate hoy = LocalDate.now();
        int enviosHoy = (int) envios.stream()
                .filter(envio -> hoy.equals(envio.getFecha()))
                .count();
        int minutoActualUtc = estadoLogisticoService.obtenerMinutoActualUtc();
        int entregadas = (int) envios.stream()
                .filter(envio -> estadoLogisticoService.estaEnvioEntregado(
                        envio,
                        minutoActualUtc,
                        false
                ))
                .count();
        int cumplimiento = envios.isEmpty()
                ? 100
                : (int) Math.round((entregadas * 100.0) / envios.size());
        int enTransito = (int) construirVuelosMapaOperacion(envios).stream()
                .filter(vuelo -> vuelo.getProgress() > 0.0 && vuelo.getProgress() < 1.0)
                .count();

        return new EstadoOperacionResponse(
                LocalDateTime.now().toString(),
                enviosHoy,
                enTransito,
                entregadas,
                cumplimiento
        );
    }

    @Transactional(readOnly = true)
    public MapaSimulacionEstado obtenerMapaOperacion() {
        List<SolicitudEnvio> envios = obtenerEnviosOperacion();
        return new MapaSimulacionEstado(
                0,
                construirOcupacionPorAeropuertoOperacion(envios),
                construirVuelosMapaOperacion(envios),
                construirCancelacionesRecientesMapaOperacion()
        );
    }

    private List<MapaSimulacionEstado.CancelacionVueloMapa> construirCancelacionesRecientesMapaOperacion() {
        LocalDateTime ahora = LocalDateTime.now();
        return vueloCancelacionRepository
                .findByFechaHoraCancelacionBetween(
                        ahora.minusMinutes(VENTANA_CANCELACIONES_MAPA_REAL_MIN),
                        ahora.plusSeconds(10)
                )
                .stream()
                .map(cancelacion -> {
                    Vuelo vuelo = cancelacion.getVuelo();
                    if (vuelo == null || vuelo.getDesde() == null) {
                        return null;
                    }

                    return new MapaSimulacionEstado.CancelacionVueloMapa(
                            "op-cancel-" + cancelacion.getIdCancelacion(),
                            vuelo.getDesde().getCodigo(),
                            String.valueOf(vuelo.getIdVuelo())
                    );
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<SolicitudEnvio> normalizarSolicitudes(List<SolicitudEnvio> solicitudesEntrantes) {
        List<SolicitudEnvio> solicitudes = new ArrayList<>();

        for (SolicitudEnvio envio : solicitudesEntrantes) {
            if (envio.getOrigen() == null || envio.getOrigen().getCodigo() == null) {
                throw new IllegalArgumentException("Cada envio debe incluir origen.codigo.");
            }

            if (envio.getDestino() == null || envio.getDestino().getCodigo() == null) {
                throw new IllegalArgumentException("Cada envio debe incluir destino.codigo.");
            }

            Aeropuerto origen = aeropuertoRepository.findByCodigo(envio.getOrigen().getCodigo())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No existe aeropuerto origen: " + envio.getOrigen().getCodigo()
                    ));

            Aeropuerto destino = aeropuertoRepository.findByCodigo(envio.getDestino().getCodigo())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No existe aeropuerto destino: " + envio.getDestino().getCodigo()
                    ));

            solicitudes.add(new SolicitudEnvio(
                    null,
                    envio.getFecha() != null ? envio.getFecha() : LocalDate.now(),
                    envio.getHora() != null ? envio.getHora() : LocalTime.of(0, 0),
                    envio.getIdCliente() != null ? envio.getIdCliente() : 1,
                    origen,
                    destino,
                    envio.getContarBolsas(),
                    envio.getDiasTiempoMaximo()
            ));
        }

        return solicitudes;
    }

    private SolicitudEnvio procesarSolicitudReal(SolicitudEnvio solicitud) {
        validarSolicitud(solicitud);
        validarCapacidadOrigen(solicitud);

        solicitud.setEstado(EstadoEnvio.INGRESADO);
        solicitud.setSimulacion(null);
        SolicitudEnvio solicitudGuardada = solicitudEnvioRepository.save(solicitud);
        return planificarSolicitudRealGuardada(solicitudGuardada);
    }

    private SolicitudEnvio planificarSolicitudRealGuardada(SolicitudEnvio solicitudGuardada) {
        Aeropuerto origen = solicitudGuardada.getOrigen();

        if (!origen.tieneCapacidad(solicitudGuardada.getContarBolsas())) {
            return solicitudGuardada;
        }

        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
        solicitudEnvioRepository.save(solicitudGuardada);

        Ruta mejorRuta = encontrarMejorRutaFactible(solicitudGuardada);
        if (mejorRuta != null) {
            return guardarRutaPlanificada(solicitudGuardada, mejorRuta);
        }

        List<AsignacionPlanificada> asignaciones = planificarSolicitudDividida(solicitudGuardada);
        if (asignaciones.isEmpty()) {
            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            return solicitudEnvioRepository.save(solicitudGuardada);
        }

        return guardarAsignacionesPlanificadas(solicitudGuardada, asignaciones);
    }

    private SolicitudEnvio guardarRutaPlanificada(SolicitudEnvio solicitudGuardada, Ruta ruta) {
        return guardarAsignacionesPlanificadas(
                solicitudGuardada,
                List.of(new AsignacionPlanificada(
                        ruta,
                        solicitudGuardada.getContarBolsas(),
                        false
                ))
        );
    }

    private SolicitudEnvio guardarAsignacionesPlanificadas(
            SolicitudEnvio solicitudGuardada,
            List<AsignacionPlanificada> asignaciones
    ) {
        Aeropuerto origen = solicitudGuardada.getOrigen();
        int totalAsignado = asignaciones.stream()
                .mapToInt(AsignacionPlanificada::bolsas)
                .sum();

        origen.descontarCapacidad(totalAsignado);
        aeropuertoRepository.save(origen);
        asignacionEnvioRepository.deleteByEnvio_IdEnvio(solicitudGuardada.getIdEnvio());

        Ruta rutaPrincipal = null;

        for (AsignacionPlanificada asignacion : asignaciones) {
            Ruta ruta = asignacion.ruta();
            if (!asignacion.capacidadReservada()) {
                ruta.reservarCapacidad(asignacion.bolsas());
            }

            guardarCapacidadesVuelos(ruta);
            Ruta rutaGuardada = rutaRepository.save(ruta);
            if (rutaPrincipal == null) {
                rutaPrincipal = rutaGuardada;
            }

            asignacionEnvioRepository.save(new AsignacionEnvio(
                    solicitudGuardada,
                    rutaGuardada,
                    asignacion.bolsas(),
                    EstadoEnvio.EN_PROCESO
            ));
        }

        solicitudGuardada.setRuta(rutaPrincipal);
        solicitudGuardada.setEstado(totalAsignado >= solicitudGuardada.getContarBolsas()
                ? EstadoEnvio.EN_PROCESO
                : EstadoEnvio.PARCIAL);
        return adjuntarAsignaciones(solicitudEnvioRepository.save(solicitudGuardada));
    }

    private SolicitudEnvio adjuntarAsignaciones(SolicitudEnvio envio) {
        if (envio == null || envio.getIdEnvio() == null) {
            return envio;
        }

        List<AsignacionEnvio> asignaciones = asignacionEnvioRepository
                .findByEnvio_IdEnvioOrderByIdAsignacionAsc(envio.getIdEnvio());
        envio.setAsignaciones(asignaciones.stream()
                .map(this::mapearAsignacionVista)
                .toList());
        return envio;
    }

    private List<SolicitudEnvio> adjuntarAsignaciones(List<SolicitudEnvio> envios) {
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

                asignacionesPorEnvio
                        .computeIfAbsent(asignacion.getEnvio().getIdEnvio(), ignored -> new ArrayList<>())
                        .add(mapearAsignacionVista(asignacion));
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

    private SolicitudEnvio.AsignacionEnvioVista mapearAsignacionVista(AsignacionEnvio asignacion) {
        return new SolicitudEnvio.AsignacionEnvioVista(
                asignacion.getIdAsignacion(),
                asignacion.getRuta(),
                asignacion.getCantidadBolsas(),
                asignacion.getEstado()
        );
    }

    private Ruta encontrarMejorRutaFactible(SolicitudEnvio solicitud) {
        Ruta rutaDirecta = encontrarRutaDirectaFactible(solicitud);
        if (rutaDirecta != null) {
            return rutaDirecta;
        }

        Grafo grafo = grafoService.construirGrafo();
        PlanificadorGenetico planificador = crearPlanificador(
                grafo,
                solicitud.getFechaHoraRegistro()
        );
        Ruta mejorRuta = planificador.encontrarMejorRuta(solicitud);

        return mejorRuta != null && mejorRuta.esFactible() ? mejorRuta : null;
    }

    private List<AsignacionPlanificada> planificarSolicitudDividida(SolicitudEnvio solicitud) {
        List<AsignacionPlanificada> asignaciones = new ArrayList<>();
        int restante = solicitud.getContarBolsas() != null ? solicitud.getContarBolsas() : 0;

        while (restante > 0) {
            SolicitudEnvio solicitudMinima = copiarSolicitudConCantidad(solicitud, 1);
            Ruta ruta = encontrarMejorRutaFactible(solicitudMinima);
            if (ruta == null) {
                break;
            }

            int capacidadRuta = calcularCapacidadDisponibleRuta(ruta);
            int bolsasAsignadas = Math.min(restante, capacidadRuta);
            if (bolsasAsignadas <= 0) {
                break;
            }

            ruta.reservarCapacidad(bolsasAsignadas);
            asignaciones.add(new AsignacionPlanificada(ruta, bolsasAsignadas, true));
            restante -= bolsasAsignadas;
        }

        return asignaciones;
    }

    private SolicitudEnvio copiarSolicitudConCantidad(SolicitudEnvio solicitud, int bolsas) {
        return new SolicitudEnvio(
                solicitud.getIdEnvio(),
                solicitud.getFecha(),
                solicitud.getHora(),
                solicitud.getIdCliente(),
                solicitud.getOrigen(),
                solicitud.getDestino(),
                bolsas,
                solicitud.getDiasTiempoMaximo()
        );
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

    private Ruta encontrarRutaDirectaFactible(SolicitudEnvio solicitud) {
        int minutoInicio = solicitud.getFechaHoraRegistro() != null
                ? solicitud.getFechaHoraRegistro().getHour() * 60 + solicitud.getFechaHoraRegistro().getMinute()
                : -1;
        LocalDateTime fechaBase = solicitud.getFechaHoraRegistro() != null
                ? solicitud.getFechaHoraRegistro().toLocalDate().atStartOfDay()
                : LocalDate.now().atStartOfDay();

        Vuelo mejorVuelo = null;
        double mejorIncrementoDias = Double.MAX_VALUE;

        for (Vuelo vuelo : vueloRepository.findByDesde_CodigoAndHasta_Codigo(
                solicitud.getOrigen().getCodigo(),
                solicitud.getDestino().getCodigo()
        )) {
            if (vuelo.estaCancelado() || !vuelo.tieneCapacidad(solicitud.getContarBolsas())) {
                continue;
            }

            VentanaVueloOperacionDirecta ventana = calcularVentanaVueloOperacionDirecta(vuelo, minutoInicio, fechaBase);
            if (!estaOcurrenciaOperacionDisponible(vuelo, ventana.fechaHoraSalida())) {
                continue;
            }

            double incrementoDias = calcularIncrementoDiasOperacionDirecta(ventana, minutoInicio);
            if (incrementoDias <= 0 || incrementoDias > solicitud.getDiasTiempoMaximo()) {
                continue;
            }

            if (incrementoDias < mejorIncrementoDias) {
                mejorIncrementoDias = incrementoDias;
                mejorVuelo = vuelo;
            }
        }

        if (mejorVuelo == null) {
            return null;
        }

        Ruta ruta = new Ruta();
        ruta.agregarVuelo(mejorVuelo, mejorIncrementoDias);
        ruta.evaluar(solicitud);
        return ruta.esFactible() ? ruta : null;
    }

    private VentanaVueloOperacionDirecta calcularVentanaVueloOperacionDirecta(
            Vuelo vuelo,
            int minutoReferencia,
            LocalDateTime fechaBase
    ) {
        int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salida;

        while (llegada <= salida) {
            llegada += VueloCancelacionService.MINUTOS_DIA;
        }

        if (minutoReferencia >= 0) {
            while (salida < minutoReferencia) {
                salida += VueloCancelacionService.MINUTOS_DIA;
                llegada += VueloCancelacionService.MINUTOS_DIA;
            }
        }

        return new VentanaVueloOperacionDirecta(
                vuelo,
                salida,
                llegada,
                fechaBase.plusMinutes(salida),
                fechaBase.plusMinutes(llegada)
        );
    }

    private double calcularIncrementoDiasOperacionDirecta(
            VentanaVueloOperacionDirecta ventana,
            int minutoReferencia
    ) {
        int referencia = minutoReferencia >= 0 ? minutoReferencia : ventana.salidaMinuto();
        return (ventana.llegadaMinuto() - referencia) / (double) VueloCancelacionService.MINUTOS_DIA;
    }

    private PlanificadorGenetico crearPlanificador(Grafo grafo, LocalDateTime fechaHoraInicio) {
        int minutoInicio = fechaHoraInicio != null
                ? fechaHoraInicio.getHour() * 60 + fechaHoraInicio.getMinute()
                : -1;
        LocalDateTime fechaBase = fechaHoraInicio != null
                ? fechaHoraInicio.toLocalDate().atStartOfDay()
                : LocalDate.now().atStartOfDay();

        return new PlanificadorGenetico(
                grafo,
                TAMANO_POBLACION,
                GENERACIONES,
                TASA_CRUZAMIENTO,
                TASA_MUTACION,
                TAMANO_TORNEO,
                ESCALAS_INTERMEDIAS_MAX,
                minutoInicio,
                (vuelo, salidaMinuto) -> estaOcurrenciaOperacionDisponible(vuelo, fechaBase.plusMinutes(salidaMinuto))
        );
    }

    private boolean estaOcurrenciaOperacionDisponible(Vuelo vuelo, LocalDateTime fechaHoraSalida) {
        return !vueloCancelacionRepository.existsByVuelo_IdVueloAndFechaHoraSalida(
                vuelo.getIdVuelo(),
                fechaHoraSalida
        );
    }

    private void replanificarEnviosAfectadosOperacion(VueloCancelacion cancelacion) {
        for (SolicitudEnvio envio : solicitudEnvioRepository.findBySimulacionIsNullOrderByIdEnvioAsc()) {
            if (envio.getEstado() == EstadoEnvio.COMPLETADO
                    || !envioUsaOcurrenciaCancelada(envio, cancelacion)) {
                continue;
            }

            liberarRutaOperacion(envio);
            envio.setRuta(null);
            envio.setEstado(EstadoEnvio.INGRESADO);
            solicitudEnvioRepository.save(envio);
            planificarSolicitudRealGuardada(envio);
        }
    }

    private boolean envioUsaOcurrenciaCancelada(SolicitudEnvio envio, VueloCancelacion cancelacion) {
        List<AsignacionEnvio> asignaciones = asignacionEnvioRepository
                .findByEnvio_IdEnvioOrderByIdAsignacionAsc(envio.getIdEnvio());
        List<VentanaVueloOperacion> ventanas = new ArrayList<>();

        if (asignaciones.isEmpty()) {
            ventanas.addAll(calcularVentanasRutaOperacion(envio, envio.getRuta()));
        } else {
            for (AsignacionEnvio asignacion : asignaciones) {
                ventanas.addAll(calcularVentanasRutaOperacion(envio, asignacion.getRuta()));
            }
        }

        for (VentanaVueloOperacion ventana : ventanas) {
            if (ventana.vuelo().getIdVuelo().equals(cancelacion.getVuelo().getIdVuelo())
                    && ventana.fechaHoraSalida().equals(cancelacion.getFechaHoraSalida())
                    && ventana.fechaHoraSalida().isAfter(cancelacion.getFechaHoraCancelacion())) {
                return true;
            }
        }

        return false;
    }

    private List<VentanaVueloOperacion> calcularVentanasRutaOperacion(SolicitudEnvio envio) {
        return calcularVentanasRutaOperacion(envio, envio.getRuta());
    }

    private List<VentanaVueloOperacion> calcularVentanasRutaOperacion(SolicitudEnvio envio, Ruta ruta) {
        List<VentanaVueloOperacion> ventanas = new ArrayList<>();
        if (ruta == null || ruta.getVuelos() == null || envio.getFecha() == null) {
            return ventanas;
        }

        LocalDateTime fechaBase = envio.getFecha().atStartOfDay();
        int minutoReferencia = envio.getHora() != null
                ? envio.getHora().getHour() * 60 + envio.getHora().getMinute()
                : 0;

        for (Vuelo vuelo : ruta.getVuelos()) {
            int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
            int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salida;

            while (llegada <= salida) {
                llegada += VueloCancelacionService.MINUTOS_DIA;
            }

            while (salida < minutoReferencia) {
                salida += VueloCancelacionService.MINUTOS_DIA;
                llegada += VueloCancelacionService.MINUTOS_DIA;
            }

            ventanas.add(new VentanaVueloOperacion(
                    vuelo,
                    fechaBase.plusMinutes(salida),
                    fechaBase.plusMinutes(llegada)
            ));
            minutoReferencia = llegada;
        }

        return ventanas;
    }

    private void liberarRutaOperacion(SolicitudEnvio envio) {
        List<AsignacionEnvio> asignaciones = asignacionEnvioRepository
                .findByEnvio_IdEnvioOrderByIdAsignacionAsc(envio.getIdEnvio());

        if (!asignaciones.isEmpty()) {
            int bolsasAsignadas = asignaciones.stream()
                    .mapToInt(asignacion -> asignacion.getCantidadBolsas() != null
                            ? asignacion.getCantidadBolsas()
                            : 0)
                    .sum();

            Aeropuerto origen = envio.getOrigen();
            if (origen != null) {
                origen.aumentarCapacidad(bolsasAsignadas);
                aeropuertoRepository.save(origen);
            }

            for (AsignacionEnvio asignacion : asignaciones) {
                liberarCapacidadRuta(asignacion.getRuta(), asignacion.getCantidadBolsas());
            }

            asignacionEnvioRepository.deleteByEnvio_IdEnvio(envio.getIdEnvio());
            return;
        }

        Aeropuerto origen = envio.getOrigen();
        if (origen != null) {
            origen.aumentarCapacidad(envio.getContarBolsas());
            aeropuertoRepository.save(origen);
        }

        if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
            return;
        }

        for (Vuelo vuelo : envio.getRuta().getVuelos()) {
            liberarCapacidadVuelo(vuelo, envio.getContarBolsas());
        }
    }

    private void liberarCapacidadRuta(Ruta ruta, Integer bolsas) {
        if (ruta == null || ruta.getVuelos() == null) {
            return;
        }

        for (Vuelo vuelo : ruta.getVuelos()) {
            liberarCapacidadVuelo(vuelo, bolsas);
        }
    }

    private void liberarCapacidadVuelo(Vuelo vuelo, Integer bolsas) {
        int capacidadUsada = vuelo.getCapacidadUsada() != null ? vuelo.getCapacidadUsada() : 0;
        int bolsasLiberadas = bolsas != null ? bolsas : 0;
        vuelo.setCapacidadUsada(Math.max(0, capacidadUsada - bolsasLiberadas));
        vueloRepository.save(vuelo);
    }

    private void validarSolicitud(SolicitudEnvio solicitud) {
        if (solicitud == null) {
            throw new IllegalArgumentException("La solicitud no puede ser null.");
        }

        if (solicitud.getOrigen() == null || solicitud.getDestino() == null) {
            throw new IllegalArgumentException("Cada solicitud debe tener origen y destino.");
        }

        if (solicitud.getContarBolsas() == null || solicitud.getContarBolsas() <= 0) {
            throw new IllegalArgumentException("Cada solicitud debe tener una cantidad de bolsas mayor que 0.");
        }

        if (solicitud.getDiasTiempoMaximo() == null || solicitud.getDiasTiempoMaximo() <= 0) {
            throw new IllegalArgumentException("Cada solicitud debe tener un plazo maximo mayor que 0.");
        }
    }

    private void validarCapacidadOrigen(SolicitudEnvio solicitud) {
        Aeropuerto origen = solicitud.getOrigen();
        int disponibles = origen.getCapacidad() != null ? origen.getCapacidad() : 0;
        int solicitadas = solicitud.getContarBolsas() != null ? solicitud.getContarBolsas() : 0;

        if (disponibles < solicitadas) {
            throw new IllegalArgumentException(
                    "El almacen origen " + origen.getCodigo()
                            + " solo tiene " + disponibles
                            + " maletas disponibles. No se puede registrar un envio de "
                            + solicitadas + " maletas."
            );
        }
    }

    private double calcularPlazoMaximoDias(Aeropuerto origen, Aeropuerto destino) {
        if (origen == null || destino == null) {
            return PLAZO_INTRACONTINENTAL_DIAS;
        }

        return origen.getRegion().equalsIgnoreCase(destino.getRegion())
                ? PLAZO_INTRACONTINENTAL_DIAS
                : PLAZO_INTERCONTINENTAL_DIAS;
    }

    private void guardarCapacidadesVuelos(Ruta ruta) {
        List<Vuelo> vuelos = ruta.getVuelos();

        if (vuelos == null || vuelos.isEmpty()) {
            return;
        }

        vueloRepository.saveAll(vuelos);
    }

    private Map<String, Double> construirOcupacionPorAeropuertoOperacion(List<SolicitudEnvio> envios) {
        Map<String, Integer> bolsasAsignadasPorOrigen = new HashMap<>();
        Map<String, Integer> bolsasOcupadasPorAeropuerto = new HashMap<>();
        LocalDateTime ahora = LocalDateTime.now();
        List<AsignacionEnvio> asignaciones = envios.isEmpty()
                ? List.of()
                : asignacionEnvioRepository.findByEnvioInOrderByEnvio_IdEnvioAscIdAsignacionAsc(envios);
        Map<Integer, List<AsignacionEnvio>> asignacionesPorEnvio = new HashMap<>();

        for (AsignacionEnvio asignacion : asignaciones) {
            if (asignacion.getEnvio() == null || asignacion.getEnvio().getIdEnvio() == null) {
                continue;
            }

            asignacionesPorEnvio
                    .computeIfAbsent(asignacion.getEnvio().getIdEnvio(), ignored -> new ArrayList<>())
                    .add(asignacion);
        }

        for (SolicitudEnvio envio : envios) {
            if (envio.getOrigen() == null || envio.getOrigen().getCodigo() == null) {
                continue;
            }

            List<AsignacionEnvio> asignacionesEnvio = asignacionesPorEnvio.getOrDefault(
                    envio.getIdEnvio(),
                    List.of()
            );

            if (asignacionesEnvio.isEmpty()) {
                int bolsas = envio.getContarBolsas() != null ? envio.getContarBolsas() : 0;
                if (envio.getRuta() != null) {
                    bolsasAsignadasPorOrigen.merge(envio.getOrigen().getCodigo(), bolsas, Integer::sum);
                    registrarOcupacionActualRutaOperacion(
                            bolsasOcupadasPorAeropuerto,
                            envio,
                            envio.getRuta(),
                            bolsas,
                            ahora
                    );
                }
                continue;
            }

            int bolsasAsignadas = 0;
            for (AsignacionEnvio asignacion : asignacionesEnvio) {
                int bolsas = asignacion.getCantidadBolsas() != null
                        ? asignacion.getCantidadBolsas()
                        : 0;
                bolsasAsignadas += bolsas;
                registrarOcupacionActualRutaOperacion(
                        bolsasOcupadasPorAeropuerto,
                        envio,
                        asignacion.getRuta(),
                        bolsas,
                        ahora
                );
            }

            bolsasAsignadasPorOrigen.merge(
                    envio.getOrigen().getCodigo(),
                    bolsasAsignadas,
                    Integer::sum
            );
        }

        Map<String, Double> ocupacion = new LinkedHashMap<>();
        for (Aeropuerto aeropuerto : aeropuertoRepository.findAll()) {
            int capacidadActual = aeropuerto.getCapacidad() != null ? aeropuerto.getCapacidad() : 0;
            int bolsasAsignadas = bolsasAsignadasPorOrigen.getOrDefault(aeropuerto.getCodigo(), 0);
            int bolsasOcupadas = bolsasOcupadasPorAeropuerto.getOrDefault(aeropuerto.getCodigo(), 0);
            int capacidadBaseAprox = capacidadActual + bolsasAsignadas;

            double porcentaje = capacidadBaseAprox <= 0
                    ? 0.0
                    : Math.min(100.0, (bolsasOcupadas * 100.0) / capacidadBaseAprox);

            ocupacion.put(aeropuerto.getCodigo(), porcentaje);
        }

        return ocupacion;
    }

    private void registrarOcupacionActualRutaOperacion(
            Map<String, Integer> bolsasOcupadasPorAeropuerto,
            SolicitudEnvio envio,
            Ruta ruta,
            int bolsas,
            LocalDateTime ahora
    ) {
        if (envio == null || ruta == null || bolsas <= 0 || ahora == null) {
            return;
        }

        LocalDateTime registro = envio.getFechaHoraRegistro();
        if (registro != null && ahora.isBefore(registro)) {
            return;
        }

        List<VentanaVueloOperacion> ventanas = calcularVentanasRutaOperacion(envio, ruta);
        if (ventanas.isEmpty()) {
            return;
        }

        VentanaVueloOperacion primeraVentana = ventanas.get(0);
        if (registro != null
                && !ahora.isBefore(registro)
                && ahora.isBefore(primeraVentana.fechaHoraSalida())
                && envio.getOrigen() != null
                && envio.getOrigen().getCodigo() != null) {
            bolsasOcupadasPorAeropuerto.merge(envio.getOrigen().getCodigo(), bolsas, Integer::sum);
            return;
        }

        for (int i = 0; i < ventanas.size() - 1; i++) {
            VentanaVueloOperacion llegada = ventanas.get(i);
            VentanaVueloOperacion siguienteSalida = ventanas.get(i + 1);

            if (!ahora.isBefore(llegada.fechaHoraLlegada())
                    && ahora.isBefore(siguienteSalida.fechaHoraSalida())
                    && llegada.vuelo().getHasta() != null
                    && llegada.vuelo().getHasta().getCodigo() != null) {
                bolsasOcupadasPorAeropuerto.merge(
                        llegada.vuelo().getHasta().getCodigo(),
                        bolsas,
                        Integer::sum
                );
                return;
            }
        }
    }

    private List<MapaSimulacionEstado.VueloMapa> construirVuelosMapaOperacion(List<SolicitudEnvio> envios) {
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = new ArrayList<>();
        LocalDateTime ahoraUtc = LocalDateTime.now(java.time.ZoneOffset.UTC);
        List<AsignacionEnvio> asignaciones = envios.isEmpty()
                ? List.of()
                : asignacionEnvioRepository.findByEnvioInOrderByEnvio_IdEnvioAscIdAsignacionAsc(envios);

        if (!asignaciones.isEmpty()) {
            int indiceAsignacion = 0;
            for (AsignacionEnvio asignacion : asignaciones) {
                SolicitudEnvio envio = asignacion.getEnvio();
                Ruta ruta = asignacion.getRuta() != null
                        ? asignacion.getRuta()
                        : envio != null ? envio.getRuta() : null;

                if (envio == null || ruta == null || ruta.getVuelos() == null) {
                    continue;
                }

                int indiceVuelo = 0;
                Integer idEnvio = envio.getIdEnvio() != null ? envio.getIdEnvio() : 0;
                List<VentanaVueloOperacion> ventanas = calcularVentanasRutaOperacion(envio, ruta);

                for (VentanaVueloOperacion ventana : ventanas) {
                    Vuelo vuelo = ventana.vuelo();
                    double progress = calcularProgress(ahoraUtc, ventana);
                    vuelosMapa.add(new MapaSimulacionEstado.VueloMapa(
                            "op-" + idEnvio + "-asignacion-" + indiceAsignacion + "-vuelo-" + vuelo.getIdVuelo() + "-" + indiceVuelo,
                            vuelo.getDesde().getCodigo(),
                            vuelo.getHasta().getCodigo(),
                            progress
                    ));
                    indiceVuelo++;
                }

                indiceAsignacion++;
            }

            return vuelosMapa;
        }

        for (SolicitudEnvio envio : envios) {
            if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
                continue;
            }

            int indice = 0;
            for (VentanaVueloOperacion ventana : calcularVentanasRutaOperacion(envio)) {
                Vuelo vuelo = ventana.vuelo();
                double progress = calcularProgress(ahoraUtc, ventana);
                vuelosMapa.add(new MapaSimulacionEstado.VueloMapa(
                        "op-" + envio.getIdEnvio() + "-vuelo-" + vuelo.getIdVuelo() + "-" + indice,
                        vuelo.getDesde().getCodigo(),
                        vuelo.getHasta().getCodigo(),
                        progress
                ));
                indice++;
            }
        }

        return vuelosMapa;
    }

    private double calcularProgress(LocalDateTime ahora, VentanaVueloOperacion ventana) {
        if (ahora == null || ventana == null || !ahora.isAfter(ventana.fechaHoraSalida())) {
            return 0.0;
        }

        if (!ahora.isBefore(ventana.fechaHoraLlegada())) {
            return 1.0;
        }

        long duracionSegundos = Math.max(1, Duration.between(
                ventana.fechaHoraSalida(),
                ventana.fechaHoraLlegada()
        ).getSeconds());
        long transcurridosSegundos = Math.max(0, Duration.between(
                ventana.fechaHoraSalida(),
                ahora
        ).getSeconds());

        return Math.min(1.0, transcurridosSegundos / (double) duracionSegundos);
    }

    private record VentanaVueloOperacion(
            Vuelo vuelo,
            LocalDateTime fechaHoraSalida,
            LocalDateTime fechaHoraLlegada
    ) {
    }

    private record VentanaVueloOperacionDirecta(
            Vuelo vuelo,
            int salidaMinuto,
            int llegadaMinuto,
            LocalDateTime fechaHoraSalida,
            LocalDateTime fechaHoraLlegada
    ) {
    }

    private record AsignacionPlanificada(
            Ruta ruta,
            int bolsas,
            boolean capacidadReservada
    ) {
    }
}
