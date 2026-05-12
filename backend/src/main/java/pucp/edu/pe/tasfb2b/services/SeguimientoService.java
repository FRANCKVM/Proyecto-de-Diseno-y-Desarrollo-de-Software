package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.EnvioDetalleResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.VueloDetalleResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
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

    private final VueloRepository vueloRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;

    public SeguimientoService(
            VueloRepository vueloRepository,
            SolicitudEnvioRepository solicitudEnvioRepository
    ) {
        this.vueloRepository = vueloRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
    }

    public VueloDetalleResponse obtenerVueloDetalle(String codigo) {
        Integer idVuelo = parsearIdVuelo(codigo);

        Vuelo vuelo = vueloRepository.findById(idVuelo)
                .orElseThrow(() -> new IllegalArgumentException("No existe un vuelo con codigo " + codigo + "."));

        List<SolicitudEnvio> enviosAsociados = solicitudEnvioRepository.findByVueloId(idVuelo);
        List<VueloDetalleResponse.EnvioEnVueloResponse> envios = enviosAsociados.stream()
                .map(this::mapearEnvioEnVuelo)
                .toList();

        return new VueloDetalleResponse(
                formatearCodigoVuelo(vuelo.getIdVuelo()),
                determinarEstadoVuelo(vuelo, enviosAsociados),
                determinarTipoVuelo(vuelo.getDesde(), vuelo.getHasta()),
                vuelo.getCapacidad(),
                vuelo.getCapacidadUsada(),
                vuelo.getDesde().getCodigo(),
                vuelo.getHasta().getCodigo(),
                formatearFechaVuelo(vuelo.getSalidaUtcMin()),
                formatearFechaVuelo(vuelo.getLlegadaUtcMin()),
                envios
        );
    }

    public List<VueloDetalleResponse> listarVuelosPorAeropuerto(String codigoAeropuerto) {
        Map<Integer, Vuelo> vuelos = new LinkedHashMap<>();

        for (Vuelo vuelo : vueloRepository.findByDesde_Codigo(codigoAeropuerto)) {
            vuelos.put(vuelo.getIdVuelo(), vuelo);
        }

        for (Vuelo vuelo : vueloRepository.findByHasta_Codigo(codigoAeropuerto)) {
            vuelos.put(vuelo.getIdVuelo(), vuelo);
        }

        return vuelos.values().stream()
                .map(vuelo -> obtenerVueloDetalle(formatearCodigoVuelo(vuelo.getIdVuelo())))
                .toList();
    }

    public EnvioDetalleResponse obtenerEnvioDetalle(String codigo) {
        Integer idEnvio = parsearIdEnvio(codigo);

        SolicitudEnvio envio = solicitudEnvioRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("No existe un envio con codigo " + codigo + "."));

        Ruta ruta = envio.getRuta();
        List<EnvioDetalleResponse.HitoRutaResponse> hitos = construirHitosRuta(envio);
        List<EnvioDetalleResponse.BloquePaquetesResponse> paquetes = construirBloquesPaquetes(envio);

        double tiempoRuta = ruta != null && ruta.getTiempoTotal() != null ? ruta.getTiempoTotal() : 0.0;
        boolean dentroDePlazo = tiempoRuta <= (envio.getDiasTiempoMaximo() != null ? envio.getDiasTiempoMaximo() : 0.0);

        return new EnvioDetalleResponse(
                formatearCodigoEnvio(envio.getIdEnvio()),
                mapearEstadoEnvioDetalle(envio.getEstado()),
                "Tasf B2B",
                envio.getOrigen().getCodigo(),
                envio.getDestino().getCodigo(),
                determinarTipoVuelo(envio.getOrigen(), envio.getDestino()),
                envio.getDiasTiempoMaximo(),
                formatearFechaRegistro(envio),
                envio.getContarBolsas(),
                hitos,
                paquetes,
                construirTiempoRestante(envio, tiempoRuta, dentroDePlazo),
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

    private List<EnvioDetalleResponse.HitoRutaResponse> construirHitosRuta(SolicitudEnvio envio) {
        List<EnvioDetalleResponse.HitoRutaResponse> hitos = new ArrayList<>();
        Ruta ruta = envio.getRuta();

        if (ruta == null || ruta.getVuelos() == null || ruta.getVuelos().isEmpty()) {
            return hitos;
        }

        boolean completado = envio.getEstado() == EstadoEnvio.COMPLETADO;
        boolean enProceso = envio.getEstado() == EstadoEnvio.EN_PROCESO;

        Vuelo primerVuelo = ruta.getVuelos().getFirst();
        hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                "salida",
                envio.getOrigen().getCodigo(),
                formatearFechaRegistro(envio),
                formatearCodigoVuelo(primerVuelo.getIdVuelo()),
                completado || enProceso ? "completado" : "pendiente"
        ));

        for (int i = 0; i < ruta.getVuelos().size(); i++) {
            Vuelo vuelo = ruta.getVuelos().get(i);
            boolean esUltimo = i == ruta.getVuelos().size() - 1;

            hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                    "vuelo",
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    formatearFechaVuelo(vuelo.getSalidaUtcMin()),
                    formatearCodigoVuelo(vuelo.getIdVuelo()),
                    completado ? "completado" : (enProceso && i == 0 ? "activo" : "pendiente")
            ));

            if (!esUltimo) {
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "escala",
                        vuelo.getHasta().getCodigo(),
                        formatearFechaVuelo(vuelo.getLlegadaUtcMin()),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        completado ? "completado" : "pendiente"
                ));
            } else {
                hitos.add(new EnvioDetalleResponse.HitoRutaResponse(
                        "entrega",
                        vuelo.getHasta().getCodigo(),
                        formatearFechaVuelo(vuelo.getLlegadaUtcMin()),
                        formatearCodigoVuelo(vuelo.getIdVuelo()),
                        completado ? "completado" : "pendiente"
                ));
            }
        }

        return hitos;
    }

    private List<EnvioDetalleResponse.BloquePaquetesResponse> construirBloquesPaquetes(SolicitudEnvio envio) {
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
                    construirEstadoPaquete(envio)
            ));

            indice = fin + 1;
        }

        return bloques;
    }

    private String construirEstadoPaquete(SolicitudEnvio envio) {
        if (envio.getEstado() == EstadoEnvio.COMPLETADO) {
            return "Entregado";
        }

        if (envio.getEstado() == EstadoEnvio.EN_PROCESO && envio.getRuta() != null && !envio.getRuta().getVuelos().isEmpty()) {
            return "En vuelo " + formatearCodigoVuelo(envio.getRuta().getVuelos().getFirst().getIdVuelo());
        }

        return "Planificado";
    }

    private String construirTiempoRestante(SolicitudEnvio envio, double tiempoRuta, boolean dentroDePlazo) {
        if (envio.getEstado() == EstadoEnvio.COMPLETADO) {
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

    private String determinarTipoVuelo(Aeropuerto origen, Aeropuerto destino) {
        if (origen == null || destino == null) {
            return "intracontinental";
        }

        return origen.getRegion().equalsIgnoreCase(destino.getRegion())
                ? "intracontinental"
                : "intercontinental";
    }

    private String determinarEstadoVuelo(Vuelo vuelo, List<SolicitudEnvio> enviosAsociados) {
        if (vuelo.estaCancelado()) {
            return "cancelado";
        }

        boolean todosCompletados = !enviosAsociados.isEmpty()
                && enviosAsociados.stream().allMatch(envio -> envio.getEstado() == EstadoEnvio.COMPLETADO);

        if (todosCompletados) {
            return "completado";
        }

        if (vuelo.getCapacidadUsada() != null && vuelo.getCapacidadUsada() > 0) {
            return "en_vuelo";
        }

        return "programado";
    }

    private String mapearEstadoEnvioDetalle(EstadoEnvio estado) {
        if (estado == null) {
            return "planificado";
        }

        return switch (estado) {
            case COMPLETADO -> "entregado";
            case EN_PROCESO -> "en_transito";
            case INGRESADO -> "planificado";
        };
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
}
