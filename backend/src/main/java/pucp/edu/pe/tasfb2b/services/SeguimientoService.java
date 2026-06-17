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
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloCancelacionRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
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
    private static final Pattern VUELO_TB_PATTERN = Pattern.compile("^TB-(\\d+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern VUELO_SIM_PATTERN = Pattern.compile("vuelo-(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern VUELO_FLIGHT_PATTERN = Pattern.compile("flight-(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern VUELO_OCURRENCIA_PATTERN = Pattern.compile(
            "shipment-(\\d+)-flight-(\\d+)-(\\d+)-(\\d+)$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ENVIO_PATTERN = Pattern.compile("(\\d+)$");
    private static final int TAMANO_BLOQUE_PAQUETES = 20;
    private static final int MINUTOS_DIA = 24 * 60;

    private final VueloRepository vueloRepository;
    private final AsignacionEnvioRepository asignacionEnvioRepository;
    private final SimulacionRepository simulacionRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final VueloCancelacionRepository vueloCancelacionRepository;
    private final OperacionesService operacionesService;
    private final SimulacionService simulacionService;
    private final EstadoLogisticoService estadoLogisticoService;

    public SeguimientoService(
            VueloRepository vueloRepository,
            AsignacionEnvioRepository asignacionEnvioRepository,
            SimulacionRepository simulacionRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            VueloCancelacionRepository vueloCancelacionRepository,
            OperacionesService operacionesService,
            SimulacionService simulacionService,
            EstadoLogisticoService estadoLogisticoService
    ) {
        this.vueloRepository = vueloRepository;
        this.asignacionEnvioRepository = asignacionEnvioRepository;
        this.simulacionRepository = simulacionRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.vueloCancelacionRepository = vueloCancelacionRepository;
        this.operacionesService = operacionesService;
        this.simulacionService = simulacionService;
        this.estadoLogisticoService = estadoLogisticoService;
    }

    public VueloDetalleResponse obtenerVueloDetalle(String codigo) {
        return obtenerVueloDetalle(codigo, null);
    }

    public VueloDetalleResponse obtenerVueloDetalle(String codigo, Integer idSimulacion) {
        Integer idVuelo = parsearIdVuelo(codigo);
        Vuelo vuelo = idSimulacion != null
                ? obtenerVueloDesdeContextoSimulado(idSimulacion, idVuelo)
                : vueloRepository.findById(idVuelo)
                .orElseThrow(() -> new IllegalArgumentException("No existe un vuelo con codigo " + codigo + "."));

        List<SolicitudEnvio> enviosAsociados = cargarEnviosAsociados(List.of(vuelo), idSimulacion);
        Integer salidaOcurrencia = parsearSalidaOcurrenciaVuelo(codigo);

        return construirVueloDetalle(vuelo, idSimulacion, enviosAsociados, salidaOcurrencia);
    }

    @Transactional
    public VueloDetalleResponse cancelarVuelo(String codigo, CancelarVueloRequest request) {
        if (request == null || request.fechaSalida() == null || request.fechaSalida().isBlank()) {
            throw new IllegalArgumentException("La fecha de salida del vuelo es obligatoria.");
        }

        Integer idVuelo = parsearIdVuelo(codigo);
        LocalDateTime fechaSalida = parsearFechaHora(request.fechaSalida());

        if (request.idSimulacion() != null) {
            LocalDateTime fechaInicioSimulacion = obtenerFechaInicioSimulacion(request.idSimulacion());
            if (fechaInicioSimulacion == null) {
                throw new IllegalArgumentException("No existe fecha de inicio para la simulacion solicitada.");
            }

            int salidaMinuto = (int) java.time.Duration.between(
                    fechaInicioSimulacion,
                    fechaSalida
            ).toMinutes();
            simulacionService.cancelarVueloSimulado(request.idSimulacion(), idVuelo, salidaMinuto);
            return obtenerVueloDetalle(codigo, request.idSimulacion());
        }

        operacionesService.cancelarVueloOperacion(idVuelo, fechaSalida);
        return obtenerVueloDetalle(codigo, null);
    }

    private VueloDetalleResponse construirVueloDetalle(
            Vuelo vuelo,
            Integer idSimulacion,
            List<SolicitudEnvio> enviosAsociados,
            Integer salidaOcurrencia
    ) {
        Integer minutoReferencia = obtenerMinutoReferenciaVuelo(enviosAsociados);
        boolean contextoFinalizado = contextoFinalizadoVuelo(enviosAsociados);
        LocalDateTime fechaInicioSimulacion = obtenerFechaInicioSimulacion(idSimulacion);
        Integer minutoReferenciaFechas = obtenerMinutoReferenciaFechasVuelo(
                idSimulacion,
                fechaInicioSimulacion,
                enviosAsociados
        );
        List<VueloDetalleResponse.EnvioEnVueloResponse> envios = filtrarEnviosPorOcurrenciaVuelo(
                vuelo,
                enviosAsociados,
                idSimulacion,
                fechaInicioSimulacion,
                minutoReferenciaFechas,
                salidaOcurrencia
        ).stream()
                .map(this::mapearEnvioEnVuelo)
                .toList();
        List<AsignacionEnvio> asignaciones = filtrarAsignacionesPorContexto(
                asignacionEnvioRepository.findByVueloId(vuelo.getIdVuelo()),
                idSimulacion
        );

        if (!asignaciones.isEmpty()) {
            envios = asignaciones.stream()
                    .filter(asignacion -> asignacionUsaVuelo(
                            asignacion,
                            vuelo.getIdVuelo(),
                            salidaOcurrencia,
                            idSimulacion,
                            fechaInicioSimulacion,
                            minutoReferenciaFechas
                    ))
                    .map(this::mapearAsignacionEnVuelo)
                    .toList();
        }

        String estadoVuelo = determinarEstadoVueloDetalle(
                vuelo,
                idSimulacion,
                fechaInicioSimulacion,
                minutoReferenciaFechas,
                salidaOcurrencia,
                minutoReferencia,
                contextoFinalizado
        );

        return new VueloDetalleResponse(
                formatearCodigoVuelo(vuelo.getIdVuelo()),
                estadoVuelo,
                determinarTipoVuelo(vuelo.getDesde(), vuelo.getHasta()),
                vuelo.getCapacidad(),
                vuelo.getCapacidadUsada(),
                vuelo.getDesde().getCodigo(),
                vuelo.getHasta().getCodigo(),
                formatearFechaSalidaVuelo(vuelo, fechaInicioSimulacion, minutoReferenciaFechas, salidaOcurrencia),
                formatearFechaLlegadaVuelo(vuelo, fechaInicioSimulacion, minutoReferenciaFechas, salidaOcurrencia),
                envios
        );
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(String codigoAeropuerto) {
        return listarVuelosPorAeropuerto(codigoAeropuerto, null);
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(
            String codigoAeropuerto,
            Integer idSimulacion
    ) {
        if (idSimulacion != null) {
            List<Vuelo> vuelosSimulados = simulacionService.listarVuelosSimuladosPorAeropuerto(idSimulacion, codigoAeropuerto);
            Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = agruparEnviosPorVuelo(vuelosSimulados, idSimulacion);

            return vuelosSimulados.stream()
                    .map(vuelo -> construirVueloDetalle(
                            vuelo,
                            idSimulacion,
                            enviosPorVuelo.getOrDefault(vuelo.getIdVuelo(), List.of()),
                            null
                    ))
                    .toList();
        }

        List<Vuelo> vuelos = vueloRepository.findConectadosByAeropuertoCodigo(codigoAeropuerto);
        Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = agruparEnviosPorVuelo(vuelos, null);

        return vuelos.stream()
                .map(vuelo -> construirVueloDetalle(
                        vuelo,
                        null,
                        enviosPorVuelo.getOrDefault(vuelo.getIdVuelo(), List.of()),
                        null
                ))
                .toList();
    }

    private List<SolicitudEnvio> cargarEnviosAsociados(List<Vuelo> vuelos, Integer idSimulacion) {
        List<Integer> idsVuelo = vuelos.stream()
                .map(Vuelo::getIdVuelo)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (idsVuelo.isEmpty()) {
            return List.of();
        }

        List<SolicitudEnvio> envios = new ArrayList<>();
        Set<Integer> idsEnvio = new HashSet<>();

        for (SolicitudEnvio envio : filtrarEnviosPorContexto(
                solicitudEnvioRepository.findByVueloIds(idsVuelo),
                idSimulacion
        )) {
            if (idsEnvio.add(envio.getIdEnvio())) {
                envios.add(envio);
            }
        }

        for (AsignacionEnvio asignacion : filtrarAsignacionesPorContexto(
                asignacionEnvioRepository.findByVueloIds(idsVuelo),
                idSimulacion
        )) {
            SolicitudEnvio envio = asignacion.getEnvio();
            if (envio != null && idsEnvio.add(envio.getIdEnvio())) {
                envios.add(envio);
            }
        }

        return envios;
    }

    private Map<Integer, List<SolicitudEnvio>> agruparEnviosPorVuelo(List<Vuelo> vuelos, Integer idSimulacion) {
        Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = new LinkedHashMap<>();
        List<Integer> idsVuelo = vuelos.stream()
                .map(Vuelo::getIdVuelo)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Set<String> clavesAgregadas = new HashSet<>();

        if (!idsVuelo.isEmpty()) {
            for (AsignacionEnvio asignacion : filtrarAsignacionesPorContexto(
                    asignacionEnvioRepository.findByVueloIds(idsVuelo),
                    idSimulacion
            )) {
                if (asignacion.getRuta() == null || asignacion.getRuta().getVuelos() == null
                        || asignacion.getEnvio() == null) {
                    continue;
                }

                for (Vuelo vuelo : asignacion.getRuta().getVuelos()) {
                    if (vuelo.getIdVuelo() == null || !idsVuelo.contains(vuelo.getIdVuelo())) {
                        continue;
                    }

                    String clave = vuelo.getIdVuelo() + "-" + asignacion.getEnvio().getIdEnvio();
                    if (clavesAgregadas.add(clave)) {
                        enviosPorVuelo
                                .computeIfAbsent(vuelo.getIdVuelo(), ignored -> new ArrayList<>())
                                .add(asignacion.getEnvio());
                    }
                }
            }
        }

        for (SolicitudEnvio envio : cargarEnviosAsociados(vuelos, idSimulacion)) {
            if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
                continue;
            }

            for (Vuelo vuelo : envio.getRuta().getVuelos()) {
                if (vuelo.getIdVuelo() == null) {
                    continue;
                }

                String clave = vuelo.getIdVuelo() + "-" + envio.getIdEnvio();
                if (clavesAgregadas.add(clave)) {
                    enviosPorVuelo
                            .computeIfAbsent(vuelo.getIdVuelo(), ignored -> new ArrayList<>())
                            .add(envio);
                }
            }
        }

        return enviosPorVuelo;
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo) {
        return obtenerEnvioDetalle(codigo, null);
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo, Integer idSimulacion) {
        Integer idEnvio = parsearIdEnvio(codigo);

        SolicitudEnvio envio = solicitudEnvioRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("No existe un envio con codigo " + codigo + "."));

        if (idSimulacion != null
                && (envio.getSimulacion() == null
                || !Objects.equals(envio.getSimulacion().getIdSimulacion(), idSimulacion))) {
            throw new IllegalArgumentException(
                    "El envio " + codigo + " no pertenece a la simulacion " + idSimulacion + "."
            );
        }

        Ruta ruta = envio.getRuta();
        List<AsignacionEnvio> asignaciones = asignacionEnvioRepository
                .findByEnvio_IdEnvioOrderByIdAsignacionAsc(envio.getIdEnvio());
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

    private VueloDetalleResponse.EnvioEnVueloResponse mapearAsignacionEnVuelo(AsignacionEnvio asignacion) {
        SolicitudEnvio envio = asignacion.getEnvio();
        return new VueloDetalleResponse.EnvioEnVueloResponse(
                formatearCodigoEnvio(envio.getIdEnvio()),
                envio.getOrigen().getCodigo(),
                envio.getDestino().getCodigo(),
                asignacion.getCantidadBolsas(),
                envio.getContarBolsas()
        );
    }

    private boolean asignacionUsaVuelo(
            AsignacionEnvio asignacion,
            Integer idVuelo,
            Integer salidaOcurrencia,
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia
    ) {
        if (asignacion.getRuta() == null || asignacion.getRuta().getVuelos() == null) {
            return false;
        }

        int minutoRuta = idSimulacion != null
                && fechaInicioSimulacion != null
                && asignacion.getEnvio() != null
                ? calcularMinutoDesdeInicioSimulacion(asignacion.getEnvio(), fechaInicioSimulacion)
                : 0;

        for (Vuelo vuelo : asignacion.getRuta().getVuelos()) {
            VentanaVueloSimulada ventana = calcularVentanaRutaVuelo(vuelo, minutoRuta);

            if (Objects.equals(vuelo.getIdVuelo(), idVuelo)) {
                if (salidaOcurrencia != null) {
                    return ventana.salidaMinuto() == salidaOcurrencia;
                }

                if (idSimulacion != null && minutoReferencia != null && minutoReferencia != Integer.MAX_VALUE) {
                    return minutoReferencia >= ventana.salidaMinuto()
                            && minutoReferencia < ventana.llegadaMinuto();
                }

                return true;
            }

            minutoRuta = ventana.llegadaMinuto();
        }

        return false;
    }

    private List<EnvioDetalleResponse.HitoRutaResponse> construirHitosRuta(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        List<EnvioDetalleResponse.HitoRutaResponse> hitos = new ArrayList<>();
        Ruta ruta = envio.getRuta();

        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return hitos;
        }

        Vuelo primerVuelo = ruta.getVuelos().getFirst();
        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        LocalDateTime fechaBase = envio.getFecha() != null
                ? envio.getFecha().atStartOfDay()
                : LocalDate.now(ZoneOffset.UTC).atStartOfDay();
        int minutoRuta = envio.getHora() != null
                ? envio.getHora().getHour() * 60 + envio.getHora().getMinute()
                : 0;
        VentanaVueloSimulada primeraVentana = calcularVentanaRutaVuelo(primerVuelo, minutoRuta);
        hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                "salida",
                envio.getOrigen().getCodigo(),
                formatearFechaRegistro(envio),
                formatearCodigoVuelo(primerVuelo.getIdVuelo()),
                contextoFinalizado || minuto >= primeraVentana.salidaMinuto() ? "completado" : "pendiente"
        ));

        for (int i = 0; i < ruta.getVuelos().size(); i++) {
            Vuelo vuelo = ruta.getVuelos().get(i);
            boolean esUltimo = i == ruta.getVuelos().size() - 1;
            VentanaVueloSimulada ventana = calcularVentanaRutaVuelo(vuelo, minutoRuta);
            String estadoVuelo = contextoFinalizado || minuto >= ventana.llegadaMinuto()
                    ? "completado"
                    : minuto >= ventana.salidaMinuto()
                    ? "activo"
                    : "pendiente";

            hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                    "vuelo",
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    fechaBase.plusMinutes(ventana.salidaMinuto()).format(ISO_FORMATTER),
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    estadoVuelo
            ));

            if (!esUltimo) {
                Vuelo siguienteVuelo = ruta.getVuelos().get(i + 1);
                VentanaVueloSimulada siguienteVentana = calcularVentanaRutaVuelo(
                        siguienteVuelo,
                        ventana.llegadaMinuto()
                );
                String estadoEscala = contextoFinalizado || minuto >= siguienteVentana.salidaMinuto()
                        ? "completado"
                        : minuto >= ventana.llegadaMinuto()
                        ? "activo"
                        : "pendiente";
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "escala",
                        vuelo.getHasta().getCodigo(),
                        fechaBase.plusMinutes(ventana.llegadaMinuto()).format(ISO_FORMATTER),
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
                        fechaBase.plusMinutes(ventana.llegadaMinuto()).format(ISO_FORMATTER),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        estadoEntrega
                ));
            }

            minutoRuta = ventana.llegadaMinuto();
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

        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
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
                envio.getSimulacion(),
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
        return LocalDateTime.of(fecha, hora).format(ISO_FORMATTER);
    }

    private LocalDateTime parsearFechaHora(String valor) {
        String normalizado = valor.trim();

        if (normalizado.endsWith("Z") || normalizado.matches(".*[+-]\\d{2}:\\d{2}$")) {
            return java.time.OffsetDateTime.parse(normalizado).toLocalDateTime();
        }

        return LocalDateTime.parse(normalizado);
    }

    private String formatearFechaVuelo(Integer minutoUtc) {
        int minutos = minutoUtc != null ? minutoUtc : 0;
        LocalDateTime base = LocalDate.now(ZoneOffset.UTC).atStartOfDay().plusMinutes(minutos);
        return base.format(ISO_FORMATTER);
    }

    private String formatearFechaSalidaVuelo(
            Vuelo vuelo,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia,
            Integer salidaOcurrencia
    ) {
        if (fechaInicioSimulacion == null && salidaOcurrencia != null) {
            VentanaVueloSimulada ventana = calcularVentanaVueloPorSalida(vuelo, salidaOcurrencia);
            return LocalDate.now(ZoneOffset.UTC)
                    .atStartOfDay()
                    .plusMinutes(ventana.salidaMinuto())
                    .format(ISO_FORMATTER);
        }

        if (fechaInicioSimulacion == null) {
            return formatearFechaVuelo(vuelo.getSalidaUtcMin());
        }

        VentanaVueloSimulada ventana = salidaOcurrencia != null
                ? calcularVentanaVueloPorSalida(vuelo, salidaOcurrencia)
                : calcularVentanaVueloSimulada(vuelo, minutoReferencia);
        return fechaInicioSimulacion.plusMinutes(ventana.salidaMinuto()).format(ISO_FORMATTER);
    }

    private String formatearFechaLlegadaVuelo(
            Vuelo vuelo,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia,
            Integer salidaOcurrencia
    ) {
        if (fechaInicioSimulacion == null && salidaOcurrencia != null) {
            VentanaVueloSimulada ventana = calcularVentanaVueloPorSalida(vuelo, salidaOcurrencia);
            return LocalDate.now(ZoneOffset.UTC)
                    .atStartOfDay()
                    .plusMinutes(ventana.llegadaMinuto())
                    .format(ISO_FORMATTER);
        }

        if (fechaInicioSimulacion == null) {
            return formatearFechaVuelo(vuelo.getLlegadaUtcMin());
        }

        VentanaVueloSimulada ventana = salidaOcurrencia != null
                ? calcularVentanaVueloPorSalida(vuelo, salidaOcurrencia)
                : calcularVentanaVueloSimulada(vuelo, minutoReferencia);
        return fechaInicioSimulacion.plusMinutes(ventana.llegadaMinuto()).format(ISO_FORMATTER);
    }

    private VentanaVueloSimulada calcularVentanaVueloPorSalida(Vuelo vuelo, int salidaOcurrencia) {
        int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegadaBase = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salidaBase;

        while (llegadaBase <= salidaBase) {
            llegadaBase += MINUTOS_DIA;
        }

        int duracion = Math.max(1, llegadaBase - salidaBase);
        return new VentanaVueloSimulada(salidaOcurrencia, salidaOcurrencia + duracion);
    }

    private VentanaVueloSimulada calcularVentanaVueloSimulada(Vuelo vuelo, Integer minutoReferencia) {
        int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegadaBase = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salidaBase;

        while (llegadaBase <= salidaBase) {
            llegadaBase += MINUTOS_DIA;
        }

        int minuto = minutoReferencia != null && minutoReferencia != Integer.MAX_VALUE
                ? Math.max(0, minutoReferencia)
                : 0;
        int diaReferencia = Math.floorDiv(minuto, MINUTOS_DIA);
        int salida = salidaBase + diaReferencia * MINUTOS_DIA;
        int llegada = llegadaBase + diaReferencia * MINUTOS_DIA;

        while (llegada <= minuto) {
            salida += MINUTOS_DIA;
            llegada += MINUTOS_DIA;
        }

        return new VentanaVueloSimulada(salida, llegada);
    }

    private LocalDateTime obtenerFechaInicioSimulacion(Integer idSimulacion) {
        if (idSimulacion == null) {
            return null;
        }

        try {
            EstadoSimulacion estado = simulacionService.obtenerEstado(idSimulacion);
            if (estado.getFechaHoraInicioSimulacion() != null) {
                return estado.getFechaHoraInicioSimulacion();
            }
        } catch (IllegalArgumentException ignored) {
            // Si no es la simulacion viva en memoria, se usa la fecha persistida.
        }

        return simulacionRepository.findById(idSimulacion)
                .map(Simulacion::getFechaInicio)
                .orElse(null);
    }

    private Integer obtenerMinutoReferenciaFechasVuelo(
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion,
            List<SolicitudEnvio> enviosAsociados
    ) {
        if (idSimulacion == null) {
            return null;
        }

        try {
            return simulacionService.obtenerEstado(idSimulacion).getPunteroConsumoMinutos();
        } catch (IllegalArgumentException ignored) {
            // Para historiales sin estado en memoria, se aproxima desde los envios de esa simulacion.
        }

        if (fechaInicioSimulacion == null || enviosAsociados == null || enviosAsociados.isEmpty()) {
            return 0;
        }

        return enviosAsociados.stream()
                .mapToInt(envio -> calcularMinutoDesdeInicioSimulacion(envio, fechaInicioSimulacion))
                .max()
                .orElse(0);
    }

    private int calcularMinutoDesdeInicioSimulacion(
            SolicitudEnvio envio,
            LocalDateTime fechaInicioSimulacion
    ) {
        if (envio.getFecha() == null || envio.getHora() == null) {
            return 0;
        }

        LocalDateTime fechaHoraEnvio = LocalDateTime.of(envio.getFecha(), envio.getHora());
        long minutos = java.time.Duration.between(fechaInicioSimulacion, fechaHoraEnvio).toMinutes();
        return (int) Math.max(0, minutos);
    }

    private String determinarTipoVuelo(Aeropuerto origen, Aeropuerto destino) {
        if (origen == null || destino == null) {
            return "intracontinental";
        }

        return origen.getRegion().equalsIgnoreCase(destino.getRegion())
                ? "intracontinental"
                : "intercontinental";
    }

    private String determinarEstadoVueloDetalle(
            Vuelo vuelo,
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferenciaFechas,
            Integer salidaOcurrencia,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (estaOcurrenciaVueloCancelada(
                vuelo,
                idSimulacion,
                fechaInicioSimulacion,
                minutoReferenciaFechas,
                salidaOcurrencia
        )) {
            return "cancelado";
        }

        return estadoLogisticoService.determinarEstadoVuelo(
                vuelo,
                minutoReferencia,
                contextoFinalizado
        );
    }

    private boolean estaOcurrenciaVueloCancelada(
            Vuelo vuelo,
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia,
            Integer salidaOcurrencia
    ) {
        if (vuelo == null || vuelo.getIdVuelo() == null) {
            return false;
        }

        if (idSimulacion != null) {
            if (salidaOcurrencia == null) {
                return simulacionService.estaVueloSimuladoCanceladoEnDia(
                        idSimulacion,
                        vuelo.getIdVuelo(),
                        minutoReferencia != null ? minutoReferencia : 0
                );
            }

            return simulacionService.estaVueloSimuladoCancelado(
                    idSimulacion,
                    vuelo.getIdVuelo(),
                    salidaOcurrencia
            );
        }

        LocalDateTime fechaSalida = salidaOcurrencia != null
                ? LocalDate.now(ZoneOffset.UTC).atStartOfDay().plusMinutes(salidaOcurrencia)
                : vueloCancelacionServiceFechaSalidaActual(vuelo);

        return vueloCancelacionRepository.existsByVuelo_IdVueloAndFechaHoraSalida(
                vuelo.getIdVuelo(),
                fechaSalida
        );
    }

    private LocalDateTime vueloCancelacionServiceFechaSalidaActual(Vuelo vuelo) {
        int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        return LocalDate.now(ZoneOffset.UTC).atStartOfDay().plusMinutes(salida);
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

        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        Integer primeraSalida = estadoLogisticoService.obtenerPrimeraSalidaUtc(envio.getRuta());

        if (primeraSalida == null || minuto < primeraSalida) {
            return "planificado";
        }

        if (estadoLogisticoService.encontrarVueloActivo(envio.getRuta(), minuto) != null) {
            return "en_transito";
        }

        return "en_escala";
    }

    private Integer obtenerMinutoReferenciaEnvio(SolicitudEnvio envio) {
        if (envio.getSimulacion() == null) {
            return estadoLogisticoService.obtenerMinutoActualUtc();
        }

        if (!Boolean.TRUE.equals(envio.getSimulacion().getActiva())) {
            return Integer.MAX_VALUE;
        }

        try {
            EstadoSimulacion estado = simulacionService.obtenerEstado(envio.getSimulacion().getIdSimulacion());
            return estado.getPunteroConsumoMinutos();
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    private boolean contextoFinalizadoEnvio(SolicitudEnvio envio) {
        return envio.getSimulacion() != null
                && !Boolean.TRUE.equals(envio.getSimulacion().getActiva());
    }

    private Integer obtenerMinutoReferenciaVuelo(List<SolicitudEnvio> enviosAsociados) {
        if (enviosAsociados == null || enviosAsociados.isEmpty()) {
            return estadoLogisticoService.obtenerMinutoActualUtc();
        }

        SolicitudEnvio envioOperacion = enviosAsociados.stream()
                .filter(envio -> envio.getSimulacion() == null)
                .findFirst()
                .orElse(null);

        if (envioOperacion != null) {
            return estadoLogisticoService.obtenerMinutoActualUtc();
        }

        return obtenerMinutoReferenciaEnvio(enviosAsociados.getFirst());
    }

    private boolean contextoFinalizadoVuelo(List<SolicitudEnvio> enviosAsociados) {
        return enviosAsociados != null
                && !enviosAsociados.isEmpty()
                && enviosAsociados.stream().allMatch(this::contextoFinalizadoEnvio);
    }

    private List<SolicitudEnvio> filtrarEnviosPorContexto(
            List<SolicitudEnvio> envios,
            Integer idSimulacion
    ) {
        if (idSimulacion == null) {
            return envios.stream()
                    .filter(envio -> envio.getSimulacion() == null)
                    .toList();
        }

        return envios.stream()
                .filter(envio -> envio.getSimulacion() != null)
                .filter(envio -> Objects.equals(envio.getSimulacion().getIdSimulacion(), idSimulacion))
                .toList();
    }

    private List<AsignacionEnvio> filtrarAsignacionesPorContexto(
            List<AsignacionEnvio> asignaciones,
            Integer idSimulacion
    ) {
        if (idSimulacion == null) {
            return asignaciones.stream()
                    .filter(asignacion -> asignacion.getEnvio() != null)
                    .filter(asignacion -> asignacion.getEnvio().getSimulacion() == null)
                    .toList();
        }

        return asignaciones.stream()
                .filter(asignacion -> asignacion.getEnvio() != null)
                .filter(asignacion -> asignacion.getEnvio().getSimulacion() != null)
                .filter(asignacion -> Objects.equals(
                        asignacion.getEnvio().getSimulacion().getIdSimulacion(),
                        idSimulacion
                ))
                .toList();
    }

    private List<SolicitudEnvio> filtrarEnviosPorOcurrenciaVuelo(
            Vuelo vuelo,
            List<SolicitudEnvio> envios,
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia,
            Integer salidaOcurrencia
    ) {
        if (vuelo == null || vuelo.getIdVuelo() == null || envios == null || envios.isEmpty()) {
            return List.of();
        }

        if (salidaOcurrencia != null) {
            return envios.stream()
                    .filter(envio -> envioUsaVueloEnSalidaOcurrencia(
                            envio,
                            vuelo.getIdVuelo(),
                            salidaOcurrencia,
                            idSimulacion,
                            fechaInicioSimulacion
                    ))
                    .toList();
        }

        if (idSimulacion != null) {
            int minutoActual = minutoReferencia != null && minutoReferencia != Integer.MAX_VALUE
                    ? minutoReferencia
                    : -1;

            return envios.stream()
                    .filter(envio -> envioUsaVueloEnMinutoSimulado(
                            envio,
                            vuelo.getIdVuelo(),
                            minutoActual,
                            fechaInicioSimulacion
                    ))
                    .toList();
        }

        LocalDateTime ahoraUtc = LocalDateTime.now(ZoneOffset.UTC);
        return envios.stream()
                .filter(envio -> envioUsaVueloEnFechaHoraOperacion(envio, vuelo.getIdVuelo(), ahoraUtc))
                .toList();
    }

    private boolean envioUsaVueloEnFechaHoraOperacion(
            SolicitudEnvio envio,
            Integer idVuelo,
            LocalDateTime fechaHoraUtc
    ) {
        Ruta ruta = envio.getRuta();
        if (ruta == null || ruta.getVuelos() == null || fechaHoraUtc == null) {
            return false;
        }

        LocalDate fechaBase = envio.getFecha() != null ? envio.getFecha() : LocalDate.now(ZoneOffset.UTC);
        int minutoReferencia = envio.getHora() != null
                ? envio.getHora().getHour() * 60 + envio.getHora().getMinute()
                : 0;

        for (Vuelo vueloRuta : ruta.getVuelos()) {
            VentanaVueloSimulada ventana = calcularVentanaRutaVuelo(vueloRuta, minutoReferencia);
            LocalDateTime salida = fechaBase.atStartOfDay().plusMinutes(ventana.salidaMinuto());
            LocalDateTime llegada = fechaBase.atStartOfDay().plusMinutes(ventana.llegadaMinuto());

            if (Objects.equals(vueloRuta.getIdVuelo(), idVuelo)
                    && !fechaHoraUtc.isBefore(salida)
                    && fechaHoraUtc.isBefore(llegada)) {
                return true;
            }

            minutoReferencia = ventana.llegadaMinuto();
        }

        return false;
    }

    private boolean envioUsaVueloEnMinutoSimulado(
            SolicitudEnvio envio,
            Integer idVuelo,
            int minutoActual,
            LocalDateTime fechaInicioSimulacion
    ) {
        Ruta ruta = envio.getRuta();
        if (ruta == null || ruta.getVuelos() == null || minutoActual < 0) {
            return false;
        }

        int minutoReferencia = fechaInicioSimulacion != null
                ? calcularMinutoDesdeInicioSimulacion(envio, fechaInicioSimulacion)
                : 0;

        for (Vuelo vueloRuta : ruta.getVuelos()) {
            VentanaVueloSimulada ventana = calcularVentanaRutaVuelo(vueloRuta, minutoReferencia);

            if (Objects.equals(vueloRuta.getIdVuelo(), idVuelo)
                    && minutoActual >= ventana.salidaMinuto()
                    && minutoActual < ventana.llegadaMinuto()) {
                return true;
            }

            minutoReferencia = ventana.llegadaMinuto();
        }

        return false;
    }

    private boolean envioUsaVueloEnSalidaOcurrencia(
            SolicitudEnvio envio,
            Integer idVuelo,
            int salidaOcurrencia,
            Integer idSimulacion,
            LocalDateTime fechaInicioSimulacion
    ) {
        Ruta ruta = envio.getRuta();
        if (ruta == null || ruta.getVuelos() == null) {
            return false;
        }

        int minutoReferencia = idSimulacion != null && fechaInicioSimulacion != null
                ? calcularMinutoDesdeInicioSimulacion(envio, fechaInicioSimulacion)
                : 0;

        for (Vuelo vueloRuta : ruta.getVuelos()) {
            VentanaVueloSimulada ventana = calcularVentanaRutaVuelo(vueloRuta, minutoReferencia);

            if (Objects.equals(vueloRuta.getIdVuelo(), idVuelo)
                    && ventana.salidaMinuto() == salidaOcurrencia) {
                return true;
            }

            minutoReferencia = ventana.llegadaMinuto();
        }

        return false;
    }

    private VentanaVueloSimulada calcularVentanaRutaVuelo(Vuelo vuelo, int minutoReferencia) {
        int salidaBase = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegadaBase = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salidaBase;

        while (llegadaBase <= salidaBase) {
            llegadaBase += MINUTOS_DIA;
        }

        int minuto = Math.max(0, minutoReferencia);
        int diaReferencia = Math.floorDiv(minuto, MINUTOS_DIA);
        int salida = salidaBase + diaReferencia * MINUTOS_DIA;
        int llegada = llegadaBase + diaReferencia * MINUTOS_DIA;

        while (salida < minuto) {
            salida += MINUTOS_DIA;
            llegada += MINUTOS_DIA;
        }

        return new VentanaVueloSimulada(salida, llegada);
    }

    private Vuelo obtenerVueloDesdeContextoSimulado(Integer idSimulacion, Integer idVuelo) {
        return simulacionService.obtenerVueloSimulado(idSimulacion, idVuelo);
    }

    private Integer parsearIdVuelo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("El codigo del vuelo es obligatorio.");
        }

        Matcher tbMatcher = VUELO_TB_PATTERN.matcher(codigo.trim());
        if (tbMatcher.find()) {
            return Integer.parseInt(tbMatcher.group(1));
        }

        Matcher simMatcher = VUELO_SIM_PATTERN.matcher(codigo.trim());
        if (simMatcher.find()) {
            return Integer.parseInt(simMatcher.group(1));
        }

        Matcher flightMatcher = VUELO_FLIGHT_PATTERN.matcher(codigo.trim());
        if (flightMatcher.find()) {
            return Integer.parseInt(flightMatcher.group(1));
        }

        try {
            return Integer.parseInt(codigo.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Formato de codigo de vuelo invalido: " + codigo + ".");
        }
    }

    private Integer parsearSalidaOcurrenciaVuelo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return null;
        }

        Matcher matcher = VUELO_OCURRENCIA_PATTERN.matcher(codigo.trim());
        if (!matcher.find()) {
            return null;
        }

        return Integer.parseInt(matcher.group(4));
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

    private int valor(Integer numero) {
        return numero != null ? numero : 0;
    }

    private record VentanaVueloSimulada(int salidaMinuto, int llegadaMinuto) {
    }
}
