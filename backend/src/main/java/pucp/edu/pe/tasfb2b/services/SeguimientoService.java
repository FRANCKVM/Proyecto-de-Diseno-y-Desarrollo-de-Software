package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.CancelarVueloRequest;
import pucp.edu.pe.tasfb2b.controllers.dto.EnvioDetalleResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.VueloDetalleResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.AsignacionEnvio;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloOcurrenciaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class SeguimientoService {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final Pattern ENVIO_PATTERN = Pattern.compile(
            "^(?:ENV-)?(-?\\d+)$",
            Pattern.CASE_INSENSITIVE
    );
    private static final int TAMANO_BLOQUE_PAQUETES = 20;

    private final AsignacionEnvioRepository asignacionEnvioRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final OperacionesService operacionesService;
    private final SimulacionService simulacionService;
    private final EstadoLogisticoService estadoLogisticoService;
    private final VueloOcurrenciaRepository vueloOcurrenciaRepository;
    private final VueloOcurrenciaService vueloOcurrenciaService;

    public SeguimientoService(
            AsignacionEnvioRepository asignacionEnvioRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            OperacionesService operacionesService,
            SimulacionService simulacionService,
            EstadoLogisticoService estadoLogisticoService,
            VueloOcurrenciaRepository vueloOcurrenciaRepository,
            VueloOcurrenciaService vueloOcurrenciaService
    ) {
        this.asignacionEnvioRepository = asignacionEnvioRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.operacionesService = operacionesService;
        this.simulacionService = simulacionService;
        this.estadoLogisticoService = estadoLogisticoService;
        this.vueloOcurrenciaRepository = vueloOcurrenciaRepository;
        this.vueloOcurrenciaService = vueloOcurrenciaService;
    }

    public VueloDetalleResponse obtenerOcurrenciaDetalle(Long idOcurrencia, Integer idSimulacion) {
        VueloOcurrencia ocurrencia = idSimulacion != null
                ? simulacionService.obtenerOcurrenciaSimulada(idSimulacion, idOcurrencia)
                : vueloOcurrenciaRepository.findById(idOcurrencia)
                .orElseThrow(() -> new IllegalArgumentException("No existe la ocurrencia " + idOcurrencia + "."));
        if (idSimulacion == null) {
            vueloOcurrenciaService.actualizarEstadoTemporal(ocurrencia, LocalDateTime.now(ZoneOffset.UTC));
        }
        List<SolicitudEnvio> enviosAsociados = agruparEnviosPorOcurrencia(
                List.of(ocurrencia), idSimulacion
        ).getOrDefault(ocurrencia.getIdOcurrencia(), List.of());
        return construirDetalleOcurrencia(ocurrencia, enviosAsociados);
    }

    @Transactional
    public VueloDetalleResponse cancelarOcurrencia(Long idOcurrencia, CancelarVueloRequest request) {
        if (idOcurrencia == null || request == null) {
            throw new IllegalArgumentException("La ocurrencia y el contexto son obligatorios.");
        }
        if (request.idSimulacion() != null) {
            VueloOcurrencia cancelada = simulacionService.cancelarVueloSimulado(
                    request.idSimulacion(),
                    idOcurrencia
            );
            return obtenerOcurrenciaDetalle(cancelada.getIdOcurrencia(), request.idSimulacion());
        }
        VueloOcurrencia seleccionada = vueloOcurrenciaRepository.findById(idOcurrencia)
                .orElseThrow(() -> new IllegalArgumentException("No existe la ocurrencia solicitada."));
        var cancelacion = operacionesService.cancelarVueloOperacion(
                seleccionada.getVuelo().getIdVuelo(), seleccionada.getFechaHoraSalida());
        VueloOcurrencia ocurrencia = vueloOcurrenciaRepository
                .findByVuelo_IdVueloAndFechaHoraSalida(
                        seleccionada.getVuelo().getIdVuelo(), cancelacion.getFechaHoraSalida())
                .orElseThrow(() -> new IllegalArgumentException("No existe la ocurrencia cancelada."));
        return obtenerOcurrenciaDetalle(ocurrencia.getIdOcurrencia(), null);
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(String codigoAeropuerto) {
        return listarVuelosPorAeropuerto(codigoAeropuerto, null, null);
    }

    public List<VueloDetalleResponse> listarOcurrencias(Integer idSimulacion) {
        return listarOcurrencias(idSimulacion, null);
    }

    public List<VueloDetalleResponse> listarOcurrencias(
            Integer idSimulacion,
            LocalDate fecha
    ) {
        LocalDate fechaConsulta = resolverFechaConsulta(idSimulacion, fecha);
        List<VueloOcurrencia> ocurrencias;
        if (idSimulacion != null) {
            ocurrencias = simulacionService.listarOcurrenciasSimuladas(idSimulacion, fechaConsulta);
        } else {
            ocurrencias = vueloOcurrenciaService.listarOperativas(
                    fechaConsulta.atStartOfDay(),
                    fechaConsulta.plusDays(1).atStartOfDay()
            );
        }
        return ocurrencias.stream().map(this::mapearResumenOcurrencia).toList();
    }

    private VueloDetalleResponse mapearResumenOcurrencia(VueloOcurrencia ocurrencia) {
        Vuelo vuelo = ocurrencia.getVuelo();
        String estado = switch (ocurrencia.getEstado()) {
            case PROGRAMADO -> "programado";
            case EN_VUELO -> "en_vuelo";
            case COMPLETADO -> "completado";
            case CANCELADO -> "cancelado";
        };
        return new VueloDetalleResponse(
                ocurrencia.getIdOcurrencia(),
                vuelo.getIdVuelo(),
                String.valueOf(vuelo.getIdVuelo()),
                estado,
                determinarTipoVuelo(vuelo.getDesde(), vuelo.getHasta()),
                ocurrencia.getCapacidad(),
                ocurrencia.getCapacidadUsada(),
                vuelo.getDesde().getCodigo(),
                vuelo.getHasta().getCodigo(),
                formatearUtc(ocurrencia.getFechaHoraSalida()),
                formatearUtc(ocurrencia.getFechaHoraLlegada()),
                List.of()
        );
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(
            String codigoAeropuerto,
            Integer idSimulacion
    ) {
        return listarVuelosPorAeropuerto(codigoAeropuerto, idSimulacion, null);
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(
            String codigoAeropuerto,
            Integer idSimulacion,
            LocalDate fecha
    ) {
        LocalDate fechaConsulta = resolverFechaConsulta(idSimulacion, fecha);
        if (idSimulacion != null) {
            List<VueloOcurrencia> ocurrencias = simulacionService
                    .listarOcurrenciasSimuladasPorAeropuerto(
                            idSimulacion, codigoAeropuerto, fechaConsulta
                    );
            Map<Long, List<SolicitudEnvio>> enviosPorOcurrencia =
                    agruparEnviosPorOcurrencia(ocurrencias, idSimulacion);

            return ocurrencias.stream()
                    .map(ocurrencia -> construirDetalleOcurrencia(
                            ocurrencia,
                            enviosPorOcurrencia.getOrDefault(ocurrencia.getIdOcurrencia(), List.of())))
                    .toList();
        }

        List<VueloOcurrencia> ocurrencias = vueloOcurrenciaRepository.findConectadasPorAeropuerto(
                codigoAeropuerto,
                fechaConsulta.atStartOfDay(),
                fechaConsulta.plusDays(1).atStartOfDay()
        );
        ocurrencias.forEach(o -> vueloOcurrenciaService.actualizarEstadoTemporal(o, LocalDateTime.now(ZoneOffset.UTC)));
        Map<Long, List<SolicitudEnvio>> enviosPorOcurrencia = agruparEnviosPorOcurrencia(ocurrencias, null);

        return ocurrencias.stream()
                .map(ocurrencia -> construirDetalleOcurrencia(
                        ocurrencia,
                        enviosPorOcurrencia.getOrDefault(ocurrencia.getIdOcurrencia(), List.of())))
                .toList();
    }

    private LocalDate resolverFechaConsulta(Integer idSimulacion, LocalDate fecha) {
        if (fecha != null) {
            return fecha;
        }
        return idSimulacion != null
                ? simulacionService.obtenerFechaActual(idSimulacion)
                : LocalDate.now(ZoneOffset.UTC);
    }

    private Map<Long, List<SolicitudEnvio>> agruparEnviosPorOcurrencia(
            List<VueloOcurrencia> ocurrencias,
            Integer idSimulacion
    ) {
        Set<Long> idsObjetivo = ocurrencias.stream()
                .map(VueloOcurrencia::getIdOcurrencia)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, Map<Integer, SolicitudEnvio>> agrupados = new LinkedHashMap<>();
        idsObjetivo.forEach(id -> agrupados.put(id, new LinkedHashMap<>()));

        if (idsObjetivo.isEmpty()) {
            return Map.of();
        }

        if (idSimulacion != null) {
            for (SolicitudEnvio envio : simulacionService.obtenerEnviosSimulacion(idSimulacion)) {
                registrarRutaEnOcurrencias(agrupados, idsObjetivo, envio, envio.getRuta());
                for (SolicitudEnvio.AsignacionEnvioVista asignacion : envio.getAsignaciones()) {
                    registrarRutaEnOcurrencias(agrupados, idsObjetivo, envio, asignacion.getRuta());
                }
            }
        } else {
            List<Long> ids = idsObjetivo.stream().toList();
            for (SolicitudEnvio envio : solicitudEnvioRepository.findByOcurrenciaIds(ids)) {
                registrarRutaEnOcurrencias(agrupados, idsObjetivo, envio, envio.getRuta());
            }
            for (AsignacionEnvio asignacion : asignacionEnvioRepository.findByOcurrenciaIds(ids)) {
                registrarRutaEnOcurrencias(
                        agrupados, idsObjetivo, asignacion.getEnvio(), asignacion.getRuta()
                );
            }
        }

        Map<Long, List<SolicitudEnvio>> resultado = new LinkedHashMap<>();
        agrupados.forEach((id, envios) -> resultado.put(id, List.copyOf(envios.values())));
        return resultado;
    }

    private void registrarRutaEnOcurrencias(
            Map<Long, Map<Integer, SolicitudEnvio>> agrupados,
            Set<Long> idsObjetivo,
            SolicitudEnvio envio,
            Ruta ruta
    ) {
        if (envio == null || envio.getIdEnvio() == null || ruta == null || ruta.getOcurrencias() == null) {
            return;
        }
        for (VueloOcurrencia ocurrencia : ruta.getOcurrencias()) {
            Long id = ocurrencia.getIdOcurrencia();
            if (idsObjetivo.contains(id)) {
                agrupados.get(id).putIfAbsent(envio.getIdEnvio(), envio);
            }
        }
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo) {
        return obtenerEnvioDetalle(codigo, null);
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo, Integer idSimulacion) {
        Integer idEnvio = parsearIdEnvio(codigo);

        SolicitudEnvio envio = idSimulacion != null
                ? simulacionService.obtenerEnviosSimulacion(idSimulacion).stream()
                .filter(candidato -> Objects.equals(candidato.getIdEnvio(), idEnvio))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "No existe el envio " + codigo + " en la simulacion " + idSimulacion + "."))
                : solicitudEnvioRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("No existe un envio con codigo " + codigo + "."));

        Ruta ruta = envio.getRuta();
        List<AsignacionEnvio> asignaciones = idSimulacion != null
                ? envio.getAsignaciones().stream()
                .map(vista -> new AsignacionEnvio(
                        envio, vista.getRuta(), vista.getCantidadBolsas(), vista.getEstado()))
                .toList()
                : asignacionEnvioRepository.findByEnvio_IdEnvioOrderByIdAsignacionAsc(envio.getIdEnvio());
        Integer minutoReferencia = obtenerMinutoReferenciaEnvio(envio);
        boolean contextoFinalizado = contextoFinalizadoEnvio(envio);
        String estadoDetalle = determinarEstadoEnvioDetalle(
                envio,
                minutoReferencia,
                contextoFinalizado
        );
        List<EnvioDetalleResponse.HitoRutaResponse> hitos = construirHitosRuta(
                envio,
                minutoReferencia,
                contextoFinalizado
        );
        List<EnvioDetalleResponse.BloquePaquetesResponse> paquetes = construirBloquesPaquetes(
                envio,
                asignaciones,
                minutoReferencia,
                contextoFinalizado
        );

        double tiempoRuta = !asignaciones.isEmpty()
                ? asignaciones.stream()
                .map(AsignacionEnvio::getRuta)
                .filter(Objects::nonNull)
                .mapToDouble(asignacionRuta -> asignacionRuta.getTiempoTotal() != null
                        ? asignacionRuta.getTiempoTotal()
                        : 0.0)
                .max()
                .orElse(0.0)
                : ruta != null && ruta.getTiempoTotal() != null ? ruta.getTiempoTotal() : 0.0;
        boolean dentroDePlazo = tiempoRuta <= (envio.getDiasTiempoMaximo() != null ? envio.getDiasTiempoMaximo() : 0.0);

        return new EnvioDetalleResponse(
                formatearCodigoEnvio(envio.getIdEnvio()),
                estadoDetalle,
                "Tasf B2B",
                envio.getOrigen().getCodigo(),
                envio.getDestino().getCodigo(),
                determinarTipoVuelo(envio.getOrigen(), envio.getDestino()),
                envio.getDiasTiempoMaximo(),
                formatearFechaRegistro(envio),
                envio.getContarBolsas(),
                hitos,
                paquetes,
                construirTiempoRestante(envio, tiempoRuta, dentroDePlazo, estadoDetalle),
                dentroDePlazo
        );
    }

    private VueloDetalleResponse.EnvioEnVueloResponse mapearEnvioEnVuelo(SolicitudEnvio envio) {
        return new VueloDetalleResponse.EnvioEnVueloResponse(
                formatearCodigoEnvio(envio.getIdEnvio()),
                envio.getOrigen().getCodigo(),
                envio.getDestino().getCodigo(),
                envio.getContarBolsas(),
                envio.getContarBolsas()
        );
    }

    private List<EnvioDetalleResponse.HitoRutaResponse> construirHitosRuta(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        List<EnvioDetalleResponse.HitoRutaResponse> hitos = new ArrayList<>();
        Ruta ruta = envio.getRuta();

        if (ruta == null || ruta.getOcurrencias().isEmpty()) {
            return hitos;
        }

        VueloOcurrencia primeraOcurrencia = ruta.getOcurrencias().getFirst();
        Vuelo primerVuelo = primeraOcurrencia.getVuelo();
        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        LocalDateTime fechaBase = envio.getFecha() != null
                ? envio.getFecha().atStartOfDay()
                : LocalDate.now(ZoneOffset.UTC).atStartOfDay();
        int primeraSalida = (int) ChronoUnit.MINUTES.between(fechaBase, primeraOcurrencia.getFechaHoraSalida());
        hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                "salida",
                envio.getOrigen().getCodigo(),
                formatearFechaRegistro(envio),
                formatearCodigoVuelo(primerVuelo.getIdVuelo()),
                contextoFinalizado || minuto >= primeraSalida ? "completado" : "pendiente"
        ));

        for (int i = 0; i < ruta.getOcurrencias().size(); i++) {
            VueloOcurrencia ocurrencia = ruta.getOcurrencias().get(i);
            Vuelo vuelo = ocurrencia.getVuelo();
            boolean esUltimo = i == ruta.getOcurrencias().size() - 1;
            int salida = (int) ChronoUnit.MINUTES.between(fechaBase, ocurrencia.getFechaHoraSalida());
            int llegada = (int) ChronoUnit.MINUTES.between(fechaBase, ocurrencia.getFechaHoraLlegada());
            String estadoVuelo = contextoFinalizado || minuto >= llegada
                    ? "completado"
                    : minuto >= salida
                    ? "activo"
                    : "pendiente";

            hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                    "vuelo",
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    formatearUtc(ocurrencia.getFechaHoraSalida()),
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    estadoVuelo
            ));

            if (!esUltimo) {
                VueloOcurrencia siguienteOcurrencia = ruta.getOcurrencias().get(i + 1);
                int siguienteSalida = (int) ChronoUnit.MINUTES.between(fechaBase, siguienteOcurrencia.getFechaHoraSalida());
                String estadoEscala = contextoFinalizado || minuto >= siguienteSalida
                        ? "completado"
                        : minuto >= llegada
                        ? "activo"
                        : "pendiente";
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "escala",
                        vuelo.getHasta().getCodigo(),
                        formatearUtc(ocurrencia.getFechaHoraLlegada()),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        estadoEscala
                ));
            } else {
                String estadoEntrega = estadoLogisticoService.estaEnvioEntregado(
                        envio,
                        minutoReferencia,
                        contextoFinalizado
                )
                        ? "completado"
                        : "pendiente";
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "entrega",
                        vuelo.getHasta().getCodigo(),
                        formatearUtc(ocurrencia.getFechaHoraLlegada()),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        estadoEntrega
                ));
            }

        }

        return hitos;
    }

    private List<EnvioDetalleResponse.BloquePaquetesResponse> construirBloquesPaquetes(
            SolicitudEnvio envio,
            List<AsignacionEnvio> asignaciones,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        List<EnvioDetalleResponse.BloquePaquetesResponse> bloques = new ArrayList<>();
        int total = envio.getContarBolsas() != null ? envio.getContarBolsas() : 0;
        int indice = 1;

        if (asignaciones != null && !asignaciones.isEmpty()) {
            for (AsignacionEnvio asignacion : asignaciones) {
                int cantidadAsignada = asignacion.getCantidadBolsas() != null
                        ? asignacion.getCantidadBolsas()
                        : 0;
                if (cantidadAsignada <= 0) {
                    continue;
                }

                int fin = Math.min(indice + cantidadAsignada - 1, total);
                bloques.add(new EnvioDetalleResponse.BloquePaquetesResponse(
                        formatearCodigoPaquete(envio.getIdEnvio(), indice),
                        formatearCodigoPaquete(envio.getIdEnvio(), fin),
                        fin - indice + 1,
                        construirEstadoPaquete(envio, asignacion.getRuta(), minutoReferencia, contextoFinalizado)
                ));
                indice = fin + 1;
            }

            if (indice <= total) {
                bloques.add(new EnvioDetalleResponse.BloquePaquetesResponse(
                        formatearCodigoPaquete(envio.getIdEnvio(), indice),
                        formatearCodigoPaquete(envio.getIdEnvio(), total),
                        total - indice + 1,
                        "Pendiente de espacio"
                ));
            }

            return bloques;
        }

        while (indice <= total) {
            int fin = Math.min(indice + TAMANO_BLOQUE_PAQUETES - 1, total);
            int cantidad = fin - indice + 1;

            bloques.add(new EnvioDetalleResponse.BloquePaquetesResponse(
                    formatearCodigoPaquete(envio.getIdEnvio(), indice),
                    formatearCodigoPaquete(envio.getIdEnvio(), fin),
                    cantidad,
                    construirEstadoPaquete(envio, envio.getRuta(), minutoReferencia, contextoFinalizado)
            ));

            indice = fin + 1;
        }

        return bloques;
    }

    private String construirEstadoPaquete(
            SolicitudEnvio envio,
            Ruta ruta,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (estadoLogisticoService.estaEnvioEntregado(
                construirEnvioConRuta(envio, ruta),
                minutoReferencia,
                contextoFinalizado
        )) {
            return "Entregado";
        }

        if (ruta == null || ruta.getOcurrencias().isEmpty()) {
            return "Planificado";
        }

        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        Vuelo vueloActivo = estadoLogisticoService.encontrarVueloActivo(ruta, minuto);
        if (vueloActivo != null) {
            return "En vuelo " + formatearCodigoVuelo(vueloActivo.getIdVuelo());
        }

        Vuelo ultimoVuelo = estadoLogisticoService.encontrarUltimoVueloAntesDe(ruta, minuto);
        if (ultimoVuelo != null) {
            return "En escala " + ultimoVuelo.getHasta().getCodigo();
        }

        return "Planificado";
    }

    private SolicitudEnvio construirEnvioConRuta(SolicitudEnvio envio, Ruta ruta) {
        return new SolicitudEnvio(
                envio.getIdEnvio(),
                envio.getFecha(),
                envio.getHora(),
                envio.getIdCliente(),
                ruta,
                envio.getIdSimulacion(),
                envio.getOrigen(),
                envio.getDestino(),
                envio.getContarBolsas(),
                envio.getDiasTiempoMaximo(),
                envio.getEstado()
        );
    }

    private String construirTiempoRestante(
            SolicitudEnvio envio,
            double tiempoRuta,
            boolean dentroDePlazo,
            String estadoDetalle
    ) {
        if ("entregado".equals(estadoDetalle)) {
            return "Entregado";
        }

        double restanteDias = (envio.getDiasTiempoMaximo() != null ? envio.getDiasTiempoMaximo() : 0.0) - tiempoRuta;
        int horasTotales = (int) Math.round(Math.abs(restanteDias) * 24);
        int dias = horasTotales / 24;
        int horas = horasTotales % 24;

        String texto = dias > 0
                ? dias + " dia" + (dias == 1 ? "" : "s") + " " + horas + " hora" + (horas == 1 ? "" : "s")
                : horas + " hora" + (horas == 1 ? "" : "s");

        return dentroDePlazo ? texto : "Atrasado por " + texto.toLowerCase(Locale.ROOT);
    }

    private String formatearFechaRegistro(SolicitudEnvio envio) {
        LocalDate fecha = envio.getFecha() != null ? envio.getFecha() : LocalDate.now(ZoneOffset.UTC);
        LocalTime hora = envio.getHora() != null ? envio.getHora() : LocalTime.MIDNIGHT;
        return formatearUtc(LocalDateTime.of(fecha, hora));
    }

    private String determinarTipoVuelo(Aeropuerto origen, Aeropuerto destino) {
        if (origen == null || destino == null) {
            return "intracontinental";
        }

        return origen.getRegion().equalsIgnoreCase(destino.getRegion())
                ? "intracontinental"
                : "intercontinental";
    }

    private String determinarEstadoEnvioDetalle(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (!estadoLogisticoService.tieneRutaAsignada(envio)) {
            return "planificado";
        }

        if (estadoLogisticoService.estaEnvioEntregado(envio, minutoReferencia, contextoFinalizado)) {
            return "entregado";
        }

        if (envio.getRuta().getOcurrencias().stream()
                .anyMatch(o -> o.getEstado() == EstadoVueloOcurrencia.EN_VUELO)) {
            return "en_transito";
        }
        return envio.getRuta().getOcurrencias().stream()
                .anyMatch(o -> o.getEstado() == EstadoVueloOcurrencia.COMPLETADO)
                ? "en_escala"
                : "planificado";
    }

    private Integer obtenerMinutoReferenciaEnvio(SolicitudEnvio envio) {
        if (envio.getIdSimulacion() == null) {
            return estadoLogisticoService.obtenerMinutoActualUtc();
        }

        try {
            EstadoSimulacion estado = simulacionService.obtenerEstado(envio.getIdSimulacion());
            return estado.isActiva() ? estado.getPunteroConsumoMinutos() : Integer.MAX_VALUE;
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    private boolean contextoFinalizadoEnvio(SolicitudEnvio envio) {
        if (envio.getIdSimulacion() == null) {
            return false;
        }
        try {
            return !simulacionService.obtenerEstado(envio.getIdSimulacion()).isActiva();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private VueloDetalleResponse construirDetalleOcurrencia(
            VueloOcurrencia ocurrencia,
            List<SolicitudEnvio> envios
    ) {
        String estado = switch (ocurrencia.getEstado()) {
            case PROGRAMADO -> "programado";
            case EN_VUELO -> "en_vuelo";
            case COMPLETADO -> "completado";
            case CANCELADO -> "cancelado";
        };
        return new VueloDetalleResponse(
                ocurrencia.getIdOcurrencia(),
                ocurrencia.getVuelo().getIdVuelo(),
                String.valueOf(ocurrencia.getVuelo().getIdVuelo()),
                estado,
                determinarTipoVuelo(ocurrencia.getVuelo().getDesde(), ocurrencia.getVuelo().getHasta()),
                ocurrencia.getCapacidad(),
                ocurrencia.getCapacidadUsada(),
                ocurrencia.getVuelo().getDesde().getCodigo(),
                ocurrencia.getVuelo().getHasta().getCodigo(),
                formatearUtc(ocurrencia.getFechaHoraSalida()),
                formatearUtc(ocurrencia.getFechaHoraLlegada()),
                envios.stream().map(this::mapearEnvioEnVuelo).toList()
        );
    }

    private Integer parsearIdEnvio(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("El codigo del envio es obligatorio.");
        }

        Matcher matcher = ENVIO_PATTERN.matcher(codigo.trim());
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }

        throw new IllegalArgumentException("Formato de codigo de envio invalido: " + codigo + ".");
    }

    private String formatearCodigoVuelo(Integer idVuelo) {
        return String.valueOf(idVuelo);
    }

    private String formatearCodigoEnvio(Integer idEnvio) {
        return "ENV-" + String.format("%03d", idEnvio);
    }

    private String formatearCodigoPaquete(Integer idEnvio, int indice) {
        return "PKG-" + String.format("%03d", idEnvio) + "-" + String.format("%03d", indice);
    }

    private String formatearUtc(LocalDateTime fechaHora) {
        return fechaHora != null ? fechaHora.format(ISO_FORMATTER) + "Z" : null;
    }

    private int valor(Integer numero) {
        return numero != null ? numero : 0;
    }

}
