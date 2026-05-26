package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.EnvioDetalleResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.VueloDetalleResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.Simulacion;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.SimulacionRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class SeguimientoService {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final Pattern VUELO_TB_PATTERN = Pattern.compile("^TB-(\\d+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern VUELO_SIM_PATTERN = Pattern.compile("vuelo-(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENVIO_PATTERN = Pattern.compile("(\\d+)$");
    private static final int TAMANO_BLOQUE_PAQUETES = 20;
    private static final int MINUTOS_DIA = 24 * 60;

    private final VueloRepository vueloRepository;
    private final SimulacionRepository simulacionRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final SimulacionService simulacionService;
    private final EstadoLogisticoService estadoLogisticoService;

    public SeguimientoService(
            VueloRepository vueloRepository,
            SimulacionRepository simulacionRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            SimulacionService simulacionService,
            EstadoLogisticoService estadoLogisticoService
    ) {
        this.vueloRepository = vueloRepository;
        this.simulacionRepository = simulacionRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
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

        List<SolicitudEnvio> enviosAsociados = filtrarEnviosPorContexto(
                solicitudEnvioRepository.findByVueloId(idVuelo),
                idSimulacion
        );

        return construirVueloDetalle(vuelo, idSimulacion, enviosAsociados);
    }

    private VueloDetalleResponse construirVueloDetalle(
            Vuelo vuelo,
            Integer idSimulacion,
            List<SolicitudEnvio> enviosAsociados
    ) {
        List<VueloDetalleResponse.EnvioEnVueloResponse> envios = enviosAsociados.stream()
                .map(this::mapearEnvioEnVuelo)
                .toList();
        Integer minutoReferencia = obtenerMinutoReferenciaVuelo(enviosAsociados);
        boolean contextoFinalizado = contextoFinalizadoVuelo(enviosAsociados);
        LocalDateTime fechaInicioSimulacion = obtenerFechaInicioSimulacion(idSimulacion);
        Integer minutoReferenciaFechas = obtenerMinutoReferenciaFechasVuelo(
                idSimulacion,
                fechaInicioSimulacion,
                enviosAsociados
        );

        return new VueloDetalleResponse(
                formatearCodigoVuelo(vuelo.getIdVuelo()),
                estadoLogisticoService.determinarEstadoVuelo(
                        vuelo,
                        minutoReferencia,
                        contextoFinalizado
                ),
                determinarTipoVuelo(vuelo.getDesde(), vuelo.getHasta()),
                vuelo.getCapacidad(),
                vuelo.getCapacidadUsada(),
                vuelo.getDesde().getCodigo(),
                vuelo.getHasta().getCodigo(),
                formatearFechaSalidaVuelo(vuelo, fechaInicioSimulacion, minutoReferenciaFechas),
                formatearFechaLlegadaVuelo(vuelo, fechaInicioSimulacion, minutoReferenciaFechas),
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
            Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = agruparEnviosPorVuelo(
                    cargarEnviosAsociados(vuelosSimulados),
                    idSimulacion
            );

            return vuelosSimulados.stream()
                    .map(vuelo -> construirVueloDetalle(
                            vuelo,
                            idSimulacion,
                            enviosPorVuelo.getOrDefault(vuelo.getIdVuelo(), List.of())
                    ))
                    .toList();
        }

        List<Vuelo> vuelos = vueloRepository.findConectadosByAeropuertoCodigo(codigoAeropuerto);
        Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = agruparEnviosPorVuelo(
                cargarEnviosAsociados(vuelos),
                null
        );

        return vuelos.stream()
                .map(vuelo -> construirVueloDetalle(
                        vuelo,
                        null,
                        enviosPorVuelo.getOrDefault(vuelo.getIdVuelo(), List.of())
                ))
                .toList();
    }

    private List<SolicitudEnvio> cargarEnviosAsociados(List<Vuelo> vuelos) {
        List<Integer> idsVuelo = vuelos.stream()
                .map(Vuelo::getIdVuelo)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (idsVuelo.isEmpty()) {
            return List.of();
        }

        return solicitudEnvioRepository.findByVueloIds(idsVuelo);
    }

    private Map<Integer, List<SolicitudEnvio>> agruparEnviosPorVuelo(
            List<SolicitudEnvio> envios,
            Integer idSimulacion
    ) {
        Map<Integer, List<SolicitudEnvio>> enviosPorVuelo = new LinkedHashMap<>();

        for (SolicitudEnvio envio : filtrarEnviosPorContexto(envios, idSimulacion)) {
            if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
                continue;
            }

            for (Vuelo vuelo : envio.getRuta().getVuelos()) {
                if (vuelo.getIdVuelo() == null) {
                    continue;
                }

                enviosPorVuelo
                        .computeIfAbsent(vuelo.getIdVuelo(), ignored -> new ArrayList<>())
                        .add(envio);
            }
        }

        return enviosPorVuelo;
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo) {
        Integer idEnvio = parsearIdEnvio(codigo);

        SolicitudEnvio envio = solicitudEnvioRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("No existe un envio con codigo " + codigo + "."));

        Ruta ruta = envio.getRuta();
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
                minutoReferencia,
                contextoFinalizado
        );

        double tiempoRuta = ruta != null && ruta.getTiempoTotal() != null ? ruta.getTiempoTotal() : 0.0;
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

        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return hitos;
        }

        Vuelo primerVuelo = ruta.getVuelos().getFirst();
        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                "salida",
                envio.getOrigen().getCodigo(),
                formatearFechaRegistro(envio),
                formatearCodigoVuelo(primerVuelo.getIdVuelo()),
                contextoFinalizado || minuto >= valor(primerVuelo.getSalidaUtcMin()) ? "completado" : "pendiente"
        ));

        for (int i = 0; i < ruta.getVuelos().size(); i++) {
            Vuelo vuelo = ruta.getVuelos().get(i);
            boolean esUltimo = i == ruta.getVuelos().size() - 1;
            int salida = valor(vuelo.getSalidaUtcMin());
            int llegada = valor(vuelo.getLlegadaUtcMin());
            String estadoVuelo = contextoFinalizado || minuto >= llegada
                    ? "completado"
                    : minuto >= salida
                    ? "activo"
                    : "pendiente";

            hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                    "vuelo",
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    formatearFechaVuelo(vuelo.getSalidaUtcMin()),
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    estadoVuelo
            ));

            if (!esUltimo) {
                Vuelo siguienteVuelo = ruta.getVuelos().get(i + 1);
                int salidaSiguiente = valor(siguienteVuelo.getSalidaUtcMin());
                String estadoEscala = contextoFinalizado || minuto >= salidaSiguiente
                        ? "completado"
                        : minuto >= llegada
                        ? "activo"
                        : "pendiente";
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "escala",
                        vuelo.getHasta().getCodigo(),
                        formatearFechaVuelo(vuelo.getLlegadaUtcMin()),
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
                        formatearFechaVuelo(vuelo.getLlegadaUtcMin()),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        estadoEntrega
                ));
            }
        }

        return hitos;
    }

    private List<EnvioDetalleResponse.BloquePaquetesResponse> construirBloquesPaquetes(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        List<EnvioDetalleResponse.BloquePaquetesResponse> bloques = new ArrayList<>();
        int total = envio.getContarBolsas() != null ? envio.getContarBolsas() : 0;
        int indice = 1;

        while (indice <= total) {
            int fin = Math.min(indice + TAMANO_BLOQUE_PAQUETES - 1, total);
            int cantidad = fin - indice + 1;

            bloques.add(new EnvioDetalleResponse.BloquePaquetesResponse(
                    formatearCodigoPaquete(envio.getIdEnvio(), indice),
                    formatearCodigoPaquete(envio.getIdEnvio(), fin),
                    cantidad,
                    construirEstadoPaquete(envio, minutoReferencia, contextoFinalizado)
            ));

            indice = fin + 1;
        }

        return bloques;
    }

    private String construirEstadoPaquete(
            SolicitudEnvio envio,
            Integer minutoReferencia,
            boolean contextoFinalizado
    ) {
        if (estadoLogisticoService.estaEnvioEntregado(envio, minutoReferencia, contextoFinalizado)) {
            return "Entregado";
        }

        if (!estadoLogisticoService.tieneRutaAsignada(envio)) {
            return "Planificado";
        }

        int minuto = minutoReferencia != null ? minutoReferencia : Integer.MIN_VALUE;
        Vuelo vueloActivo = estadoLogisticoService.encontrarVueloActivo(envio.getRuta(), minuto);
        if (vueloActivo != null) {
            return "En vuelo " + formatearCodigoVuelo(vueloActivo.getIdVuelo());
        }

        Vuelo ultimoVuelo = estadoLogisticoService.encontrarUltimoVueloAntesDe(envio.getRuta(), minuto);
        if (ultimoVuelo != null) {
            return "En escala " + ultimoVuelo.getHasta().getCodigo();
        }

        return "Planificado";
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

    private String formatearFechaVuelo(Integer minutoUtc) {
        int minutos = minutoUtc != null ? minutoUtc : 0;
        LocalDateTime base = LocalDate.now(ZoneOffset.UTC).atStartOfDay().plusMinutes(minutos);
        return base.format(ISO_FORMATTER);
    }

    private String formatearFechaSalidaVuelo(
            Vuelo vuelo,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia
    ) {
        if (fechaInicioSimulacion == null) {
            return formatearFechaVuelo(vuelo.getSalidaUtcMin());
        }

        VentanaVueloSimulada ventana = calcularVentanaVueloSimulada(vuelo, minutoReferencia);
        return fechaInicioSimulacion.plusMinutes(ventana.salidaMinuto()).format(ISO_FORMATTER);
    }

    private String formatearFechaLlegadaVuelo(
            Vuelo vuelo,
            LocalDateTime fechaInicioSimulacion,
            Integer minutoReferencia
    ) {
        if (fechaInicioSimulacion == null) {
            return formatearFechaVuelo(vuelo.getLlegadaUtcMin());
        }

        VentanaVueloSimulada ventana = calcularVentanaVueloSimulada(vuelo, minutoReferencia);
        return fechaInicioSimulacion.plusMinutes(ventana.llegadaMinuto()).format(ISO_FORMATTER);
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

        try {
            return Integer.parseInt(codigo.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Formato de codigo de vuelo invalido: " + codigo + ".");
        }
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
