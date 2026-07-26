package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.controllers.dto.BaggageItemResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.PagedResponse;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class EnvioListadoService {

    private static final int MAX_PAGE_SIZE = 500;
    private static final String STATUS_REGISTRADOS = "registrados";
    private static final String STATUS_PLANIFICADOS = "planificados";
    private static final String STATUS_EN_TRANSITO = "en-transito";
    private static final String STATUS_COMPLETADOS = "completados";
    private static final String STATUS_ENTREGADOS = "entregados";
    private static final Pattern BAG_CODE_PATTERN = Pattern.compile(
            "^ENV-(SIM-)?(\\d+)-BAG-(\\d+)$",
            Pattern.CASE_INSENSITIVE
    );

    private final EstadoLogisticoService estadoLogisticoService;

    public EnvioListadoService(EstadoLogisticoService estadoLogisticoService) {
        this.estadoLogisticoService = estadoLogisticoService;
    }

    public PagedResponse<SolicitudEnvio> paginarEnvios(
            List<SolicitudEnvio> envios,
            int page,
            int size,
            String codigo,
            String estado,
            String aeropuerto,
            String direccion,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        int safePage = Math.max(0, page);
        int safeSize = normalizarTamanoPagina(size);
        String estadoFiltro = normalizarFiltro(estado);
        String direccionFiltro = normalizarFiltro(direccion);
        String codigoFiltro = normalizarTexto(codigo);
        String aeropuertoFiltro = normalizarTexto(aeropuerto);

        List<SolicitudEnvio> base = envios.stream()
                .filter(envio -> coincideCodigoEnvio(envio, codigoFiltro))
                .filter(envio -> coincideAeropuertoEnvio(envio, aeropuertoFiltro))
                .toList();

        LocalDateTime fechaReferencia = normalizarReferencia(referencia);
        Map<String, Long> countsByDirection = contarDireccionesEnvio(base, aeropuertoFiltro);
        List<SolicitudEnvio> porDireccion = base.stream()
                .filter(envio -> coincideDireccionEnvio(envio, aeropuertoFiltro, direccionFiltro))
                .toList();
        Map<String, Long> counts = contarEstadosEnvio(porDireccion, horasEntregados, fechaReferencia);
        List<SolicitudEnvio> filtrados = porDireccion.stream()
                .filter(envio -> coincideEstadoEnvio(envio, estadoFiltro, horasEntregados, fechaReferencia))
                .toList();

        return paginar(filtrados, safePage, safeSize, counts, countsByDirection);
    }

    public PagedResponse<BaggageItemResponse> paginarMaletas(
            List<SolicitudEnvio> envios,
            int page,
            int size,
            String codigo,
            String estado,
            String aeropuerto,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        int safePage = Math.max(0, page);
        int safeSize = normalizarTamanoPagina(size);
        int offset = safePage * safeSize;
        String estadoFiltro = normalizarFiltro(estado);
        String codigoFiltro = normalizarTexto(codigo);
        String aeropuertoFiltro = normalizarTexto(aeropuerto);
        LocalDateTime fechaReferencia = normalizarReferencia(referencia);
        ParsedBagCode parsedBagCode = parseBagCode(codigoFiltro);

        List<BaggageItemResponse> items = new ArrayList<>();
        Map<String, Long> counts = inicializarConteoEstados();
        long total = 0;

        for (SolicitudEnvio envio : envios) {
            if (!coincideAeropuertoMaleta(envio, aeropuertoFiltro)) {
                continue;
            }

            if (parsedBagCode != null && !Objects.equals(envio.getIdEnvio(), parsedBagCode.shipmentId())) {
                continue;
            }

            String estadoEnvio = resolverEstadoVisual(envio, fechaReferencia);
            List<RouteGroup> grupos = obtenerGruposRuta(envio);
            int totalBags = envio.getContarBolsas() != null ? envio.getContarBolsas() : 0;
            int nextBagIndex = 1;

            for (RouteGroup grupo : grupos) {
                int cantidad = Math.max(0, grupo.cantidadBolsas());
                int start = nextBagIndex;
                int end = Math.min(totalBags, nextBagIndex + cantidad - 1);

                for (int bagIndex = start; bagIndex <= end; bagIndex++) {
                    total = agregarMaletaSiCoincide(
                            items,
                            counts,
                            total,
                            offset,
                            safeSize,
                            envio,
                            bagIndex,
                            grupo.ruta(),
                            true,
                            estadoEnvio,
                            estadoFiltro,
                            horasEntregados,
                            fechaReferencia,
                            codigoFiltro,
                            parsedBagCode
                    );
                }

                nextBagIndex = end + 1;
            }

            for (int bagIndex = nextBagIndex; bagIndex <= totalBags; bagIndex++) {
                total = agregarMaletaSiCoincide(
                        items,
                        counts,
                        total,
                        offset,
                        safeSize,
                        envio,
                        bagIndex,
                        null,
                        false,
                        estadoEnvio,
                        estadoFiltro,
                        horasEntregados,
                        fechaReferencia,
                        codigoFiltro,
                        parsedBagCode
                );
            }
        }

        counts.put("todos", total);
        int totalPages = calcularTotalPaginas(total, safeSize);
        return new PagedResponse<>(
                items,
                safePage,
                safeSize,
                total,
                totalPages,
                safePage + 1 < totalPages,
                counts,
                Map.of()
        );
    }

    private long agregarMaletaSiCoincide(
            List<BaggageItemResponse> items,
            Map<String, Long> counts,
            long total,
            int offset,
            int size,
            SolicitudEnvio envio,
            int bagIndex,
            Ruta ruta,
            boolean assigned,
            String estadoEnvio,
            String estadoFiltro,
            Integer horasEntregados,
            LocalDateTime referencia,
            String codigoFiltro,
            ParsedBagCode parsedBagCode
    ) {
        String bagCode = formatBagCode(envio, bagIndex);

        if (parsedBagCode != null && parsedBagCode.bagIndex() != bagIndex) {
            return total;
        }

        if (parsedBagCode == null && !coincideCodigo(bagCode, codigoFiltro)) {
            return total;
        }

        if (debeContarEstado(estadoEnvio, envio, horasEntregados, referencia)) {
            counts.merge(estadoEnvio, 1L, Long::sum);
        }

        if (!coincideEstadoResuelto(envio, estadoEnvio, estadoFiltro, horasEntregados, referencia)) {
            return total;
        }

        long nextTotal = total + 1;
        if (total >= offset && items.size() < size) {
            items.add(construirMaleta(envio, bagIndex, bagCode, ruta, assigned, estadoEnvio));
        }

        return nextTotal;
    }

    private BaggageItemResponse construirMaleta(
            SolicitudEnvio envio,
            int bagIndex,
            String bagCode,
            Ruta ruta,
            boolean assigned,
            String estado
    ) {
        List<BaggageItemResponse.RouteSegmentResponse> segmentos = buildRouteSegments(envio, ruta);
        return new BaggageItemResponse(
                bagCode,
                envio.getIdEnvio(),
                formatShipmentDisplayCode(envio.getIdEnvio()),
                envio.getIdEnvio() != null ? String.valueOf(envio.getIdEnvio()) : null,
                bagIndex,
                buildRouteLabel(envio, segmentos),
                segmentos,
                assigned,
                estado,
                envio.getOrigen().getCodigo(),
                envio.getDestino().getCodigo()
        );
    }

    private List<RouteGroup> obtenerGruposRuta(SolicitudEnvio envio) {
        List<RouteGroup> grupos = new ArrayList<>();
        for (SolicitudEnvio.AsignacionEnvioVista asignacion : envio.getAsignaciones()) {
            Ruta ruta = asignacion.getRuta();
            if (ruta != null && ruta.getOcurrencias() != null && !ruta.getOcurrencias().isEmpty()) {
                grupos.add(new RouteGroup(ruta, asignacion.getCantidadBolsas() != null
                        ? asignacion.getCantidadBolsas()
                        : 0));
            }
        }

        if (!grupos.isEmpty()) {
            return grupos;
        }

        Ruta ruta = envio.getRuta();
        if (ruta != null && ruta.getOcurrencias() != null && !ruta.getOcurrencias().isEmpty()) {
            grupos.add(new RouteGroup(ruta, envio.getContarBolsas() != null ? envio.getContarBolsas() : 0));
        }

        return grupos;
    }

    private Map<String, Long> contarEstadosEnvio(
            List<SolicitudEnvio> envios,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        Map<String, Long> counts = inicializarConteoEstados();
        for (SolicitudEnvio envio : envios) {
            String estado = resolverEstadoVisual(envio, referencia);
            if (debeContarEstado(estado, envio, horasEntregados, referencia)) {
                counts.merge(estado, 1L, Long::sum);
            }
        }
        counts.put("todos", (long) envios.size());
        return counts;
    }

    private Map<String, Long> inicializarConteoEstados() {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("todos", 0L);
        counts.put(STATUS_REGISTRADOS, 0L);
        counts.put(STATUS_PLANIFICADOS, 0L);
        counts.put(STATUS_EN_TRANSITO, 0L);
        counts.put(STATUS_COMPLETADOS, 0L);
        counts.put(STATUS_ENTREGADOS, 0L);
        return counts;
    }

    private boolean coincideEstadoEnvio(
            SolicitudEnvio envio,
            String estadoFiltro,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        return "todos".equals(estadoFiltro)
                || coincideEstadoResuelto(
                        envio,
                        resolverEstadoVisual(envio, referencia),
                        estadoFiltro,
                        horasEntregados,
                        referencia
                );
    }

    private String resolverEstadoVisual(
            SolicitudEnvio envio,
            LocalDateTime referencia
    ) {
        EstadoEnvio estado = estadoLogisticoService.resolverEstadoEnvio(
                envio,
                normalizarReferencia(referencia),
                false
        );
        envio.setEstado(estado);
        return estadoListado(estado);
    }

    private boolean coincideEstadoResuelto(
            SolicitudEnvio envio,
            String estadoEnvio,
            String estadoFiltro,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        if ("todos".equals(estadoFiltro)) {
            return true;
        }

        if (!estadoEnvio.equals(estadoFiltro)) {
            return false;
        }

        return !STATUS_ENTREGADOS.equals(estadoFiltro)
                || estaDentroVentanaEntregados(envio, horasEntregados, referencia);
    }

    private boolean debeContarEstado(
            String estado,
            SolicitudEnvio envio,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        return !STATUS_ENTREGADOS.equals(estado)
                || estaDentroVentanaEntregados(envio, horasEntregados, referencia);
    }

    private boolean estaDentroVentanaEntregados(
            SolicitudEnvio envio,
            Integer horasEntregados,
            LocalDateTime referencia
    ) {
        if (horasEntregados == null || horasEntregados <= 0) {
            return true;
        }

        LocalDateTime deliveredAt = obtenerFechaEntrega(envio);
        if (deliveredAt == null) {
            return envio.getEstado() == EstadoEnvio.ENTREGADO;
        }

        return !deliveredAt.isBefore(normalizarReferencia(referencia).minusHours(horasEntregados));
    }

    private LocalDateTime obtenerFechaEntrega(SolicitudEnvio envio) {
        LocalDateTime lastArrival = obtenerTimeline(envio).lastArrival();
        return lastArrival != null
                ? lastArrival.plusMinutes(EstadoLogisticoService.MINUTOS_ENTRE_COMPLETADO_Y_ENTREGADO)
                : null;
    }

    private String estadoListado(EstadoEnvio estado) {
        return switch (estado != null ? estado : EstadoEnvio.REGISTRADO) {
            case REGISTRADO -> STATUS_REGISTRADOS;
            case PLANIFICADO -> STATUS_PLANIFICADOS;
            case EN_TRANSITO -> STATUS_EN_TRANSITO;
            case COMPLETADO -> STATUS_COMPLETADOS;
            case ENTREGADO -> STATUS_ENTREGADOS;
        };
    }

    private ShipmentTimeline obtenerTimeline(SolicitudEnvio envio) {
        LocalDateTime firstDeparture = null;
        LocalDateTime lastArrival = null;

        for (RouteGroup grupo : obtenerGruposRuta(envio)) {
            for (VueloOcurrencia ocurrencia : grupo.ruta().getOcurrencias()) {
                if (ocurrencia.getFechaHoraSalida() != null) {
                    firstDeparture = firstDeparture == null
                            ? ocurrencia.getFechaHoraSalida()
                            : min(firstDeparture, ocurrencia.getFechaHoraSalida());
                }
                if (ocurrencia.getFechaHoraLlegada() != null) {
                    lastArrival = lastArrival == null
                            ? ocurrencia.getFechaHoraLlegada()
                            : max(lastArrival, ocurrencia.getFechaHoraLlegada());
                }
            }
        }

        return new ShipmentTimeline(firstDeparture, lastArrival);
    }

    private boolean coincideCodigoEnvio(SolicitudEnvio envio, String codigoFiltro) {
        return codigoFiltro.isBlank()
                || formatShipmentDisplayCode(envio.getIdEnvio()).toLowerCase(Locale.ROOT)
                .contains(codigoFiltro.toLowerCase(Locale.ROOT))
                || (envio.getIdEnvio() != null
                && String.valueOf(envio.getIdEnvio()).contains(codigoFiltro));
    }

    private boolean coincideAeropuertoEnvio(SolicitudEnvio envio, String aeropuertoFiltro) {
        return aeropuertoFiltro.isBlank()
                || "todos".equals(aeropuertoFiltro)
                || esEnvioSalienteDeAeropuerto(envio, aeropuertoFiltro)
                || esEnvioEntranteAAeropuerto(envio, aeropuertoFiltro);
    }

    private boolean coincideDireccionEnvio(
            SolicitudEnvio envio,
            String aeropuertoFiltro,
            String direccionFiltro
    ) {
        if (aeropuertoFiltro.isBlank() || "todos".equals(aeropuertoFiltro)) {
            return true;
        }

        if ("entrantes".equals(direccionFiltro)) {
            return esEnvioEntranteAAeropuerto(envio, aeropuertoFiltro);
        }

        if ("salientes".equals(direccionFiltro)) {
            return esEnvioSalienteDeAeropuerto(envio, aeropuertoFiltro);
        }

        return esEnvioEntranteAAeropuerto(envio, aeropuertoFiltro)
                || esEnvioSalienteDeAeropuerto(envio, aeropuertoFiltro);
    }

    private Map<String, Long> contarDireccionesEnvio(
            List<SolicitudEnvio> envios,
            String aeropuertoFiltro
    ) {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("todos", (long) envios.size());
        counts.put("entrantes", 0L);
        counts.put("salientes", 0L);

        if (aeropuertoFiltro.isBlank() || "todos".equals(aeropuertoFiltro)) {
            return counts;
        }

        for (SolicitudEnvio envio : envios) {
            if (esEnvioEntranteAAeropuerto(envio, aeropuertoFiltro)) {
                counts.merge("entrantes", 1L, Long::sum);
            }
            if (esEnvioSalienteDeAeropuerto(envio, aeropuertoFiltro)) {
                counts.merge("salientes", 1L, Long::sum);
            }
        }

        return counts;
    }

    private boolean esEnvioEntranteAAeropuerto(SolicitudEnvio envio, String aeropuertoIcao) {
        if (envio.getDestino().getCodigo().equalsIgnoreCase(aeropuertoIcao)) {
            return true;
        }

        return obtenerGruposRuta(envio).stream()
                .flatMap(grupo -> grupo.ruta().getOcurrencias().stream())
                .anyMatch(ocurrencia -> ocurrencia.getVuelo().getHasta().getCodigo()
                        .equalsIgnoreCase(aeropuertoIcao));
    }

    private boolean esEnvioSalienteDeAeropuerto(SolicitudEnvio envio, String aeropuertoIcao) {
        if (envio.getOrigen().getCodigo().equalsIgnoreCase(aeropuertoIcao)) {
            return true;
        }

        return obtenerGruposRuta(envio).stream()
                .flatMap(grupo -> grupo.ruta().getOcurrencias().stream())
                .anyMatch(ocurrencia -> ocurrencia.getVuelo().getDesde().getCodigo()
                        .equalsIgnoreCase(aeropuertoIcao));
    }

    private boolean coincideAeropuertoMaleta(SolicitudEnvio envio, String aeropuertoFiltro) {
        return aeropuertoFiltro.isBlank()
                || "todos".equals(aeropuertoFiltro)
                || envio.getOrigen().getCodigo().equalsIgnoreCase(aeropuertoFiltro)
                || envio.getDestino().getCodigo().equalsIgnoreCase(aeropuertoFiltro);
    }

    private boolean coincideCodigo(String value, String codigoFiltro) {
        return codigoFiltro.isBlank()
                || value.toLowerCase(Locale.ROOT).contains(codigoFiltro.toLowerCase(Locale.ROOT));
    }

    private List<BaggageItemResponse.RouteSegmentResponse> buildRouteSegments(SolicitudEnvio envio, Ruta ruta) {
        if (ruta == null || ruta.getOcurrencias() == null || ruta.getOcurrencias().isEmpty()) {
            return List.of(new BaggageItemResponse.RouteSegmentResponse(
                    envio.getOrigen().getCodigo(),
                    envio.getDestino().getCodigo()
            ));
        }

        return ruta.getOcurrencias().stream()
                .map(ocurrencia -> new BaggageItemResponse.RouteSegmentResponse(
                        ocurrencia.getVuelo().getDesde().getCodigo(),
                        ocurrencia.getVuelo().getHasta().getCodigo()
                ))
                .toList();
    }

    private String buildRouteLabel(
            SolicitudEnvio envio,
            List<BaggageItemResponse.RouteSegmentResponse> segmentos
    ) {
        if (segmentos.isEmpty()) {
            return envio.getOrigen().getCodigo() + " > " + envio.getDestino().getCodigo();
        }

        List<String> points = new ArrayList<>();
        points.add(segmentos.getFirst().fromIcao());
        for (BaggageItemResponse.RouteSegmentResponse segment : segmentos) {
            points.add(segment.toIcao());
        }

        return String.join(" > ", points);
    }

    private <T> PagedResponse<T> paginar(
            List<T> items,
            int page,
            int size,
            Map<String, Long> countsByStatus,
            Map<String, Long> countsByDirection
    ) {
        int offset = page * size;
        long total = items.size();
        List<T> pageItems = offset >= items.size()
                ? List.of()
                : items.subList(offset, Math.min(offset + size, items.size()));
        int totalPages = calcularTotalPaginas(total, size);
        return new PagedResponse<>(
                pageItems,
                page,
                size,
                total,
                totalPages,
                page + 1 < totalPages,
                countsByStatus,
                countsByDirection
        );
    }

    private int normalizarTamanoPagina(int size) {
        if (size <= 0) {
            return 80;
        }

        return Math.min(size, MAX_PAGE_SIZE);
    }

    private String normalizarFiltro(String value) {
        String normalized = normalizarTexto(value);
        if (normalized.isBlank()) {
            return "todos";
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "registrado", "registrados" -> STATUS_REGISTRADOS;
            case "planificado", "planificados" -> STATUS_PLANIFICADOS;
            case "en-transito", "en_transito" -> STATUS_EN_TRANSITO;
            case "completado", "completados" -> STATUS_COMPLETADOS;
            case "entregado", "entregados" -> STATUS_ENTREGADOS;
            default -> lower;
        };
    }

    private String normalizarTexto(String value) {
        return value == null ? "" : value.trim();
    }

    private LocalDateTime normalizarReferencia(LocalDateTime referencia) {
        return referencia != null ? referencia : LocalDateTime.now(ZoneOffset.UTC);
    }

    private int calcularTotalPaginas(long total, int size) {
        if (total <= 0) {
            return 0;
        }

        return (int) Math.ceil(total / (double) size);
    }

    private String formatBagCode(SolicitudEnvio envio, int bagIndex) {
        return formatShipmentDisplayCode(envio.getIdEnvio())
                + "-BAG-"
                + String.format("%03d", bagIndex);
    }

    private String formatShipmentDisplayCode(Integer idEnvio) {
        if (idEnvio == null) {
            return "ENV-SIN-ID";
        }

        if (idEnvio < 0) {
            return "ENV-SIM-" + String.format("%03d", Math.abs(idEnvio));
        }

        return "ENV-" + String.format("%03d", idEnvio);
    }

    private ParsedBagCode parseBagCode(String codigoFiltro) {
        if (codigoFiltro.isBlank()) {
            return null;
        }

        Matcher matcher = BAG_CODE_PATTERN.matcher(codigoFiltro);
        if (!matcher.matches()) {
            return null;
        }

        int shipmentId = Integer.parseInt(matcher.group(2));
        if (matcher.group(1) != null) {
            shipmentId = -shipmentId;
        }

        return new ParsedBagCode(shipmentId, Integer.parseInt(matcher.group(3)));
    }

    private LocalDateTime min(LocalDateTime a, LocalDateTime b) {
        return a.isBefore(b) ? a : b;
    }

    private LocalDateTime max(LocalDateTime a, LocalDateTime b) {
        return a.isAfter(b) ? a : b;
    }

    private record RouteGroup(Ruta ruta, int cantidadBolsas) {
    }

    private record ShipmentTimeline(LocalDateTime firstDeparture, LocalDateTime lastArrival) {
    }

    private record ParsedBagCode(Integer shipmentId, int bagIndex) {
    }
}
