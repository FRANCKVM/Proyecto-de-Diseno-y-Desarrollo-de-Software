package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.controllers.dto.EstadoOperacionResponse;
import pucp.edu.pe.tasfb2b.controllers.dto.RegistrarOperacionEnvioRequest;
import pucp.edu.pe.tasfb2b.algorithms.ga.PlanificadorGenetico;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.RutaRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    private final GrafoService grafoService;
    private final AeropuertoRepository aeropuertoRepository;
    private final SolicitudEnvioRepository solicitudEnvioRepository;
    private final RutaRepository rutaRepository;
    private final VueloRepository vueloRepository;

    public OperacionesService(
            GrafoService grafoService,
            AeropuertoRepository aeropuertoRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            RutaRepository rutaRepository,
            VueloRepository vueloRepository
    ) {
        this.grafoService = grafoService;
        this.aeropuertoRepository = aeropuertoRepository;
        this.solicitudEnvioRepository = solicitudEnvioRepository;
        this.rutaRepository = rutaRepository;
        this.vueloRepository = vueloRepository;
    }

    @Transactional
    public List<SolicitudEnvio> procesarBloqueReal(List<SolicitudEnvio> solicitudesEntrantes) {
        if (solicitudesEntrantes == null || solicitudesEntrantes.isEmpty()) {
            throw new IllegalArgumentException("Debe enviar al menos un envio.");
        }

        List<SolicitudEnvio> solicitudes = normalizarSolicitudes(solicitudesEntrantes);
        Grafo grafo = grafoService.construirGrafo();
        PlanificadorGenetico planificador = crearPlanificador(grafo);
        List<SolicitudEnvio> resultados = new ArrayList<>();

        for (SolicitudEnvio solicitud : solicitudes) {
            resultados.add(procesarSolicitudReal(solicitud, planificador));
        }

        return resultados;
    }

    @Transactional(readOnly = true)
    public List<SolicitudEnvio> obtenerEnviosOperacion() {
        return solicitudEnvioRepository.findBySimulacionIsNullOrderByIdEnvioAsc();
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

        return procesarBloqueReal(Collections.singletonList(solicitud)).get(0);
    }

    @Transactional(readOnly = true)
    public EstadoOperacionResponse obtenerEstadoOperacion() {
        List<SolicitudEnvio> envios = obtenerEnviosOperacion();
        LocalDate hoy = LocalDate.now();
        int enviosHoy = (int) envios.stream()
                .filter(envio -> hoy.equals(envio.getFecha()))
                .count();
        int entregadas = (int) envios.stream()
                .filter(envio -> envio.getEstado() == EstadoEnvio.COMPLETADO)
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
                construirVuelosMapaOperacion(envios)
        );
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

    private SolicitudEnvio procesarSolicitudReal(
            SolicitudEnvio solicitud,
            PlanificadorGenetico planificador
    ) {
        validarSolicitud(solicitud);

        solicitud.setEstado(EstadoEnvio.INGRESADO);
        solicitud.setSimulacion(null);
        SolicitudEnvio solicitudGuardada = solicitudEnvioRepository.save(solicitud);

        Aeropuerto origen = solicitudGuardada.getOrigen();

        if (!origen.tieneCapacidad(solicitudGuardada.getContarBolsas())) {
            return solicitudGuardada;
        }

        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
        solicitudEnvioRepository.save(solicitudGuardada);

        Ruta mejorRuta = planificador.encontrarMejorRuta(solicitudGuardada);

        if (mejorRuta == null || !mejorRuta.esFactible()) {
            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            return solicitudEnvioRepository.save(solicitudGuardada);
        }

        origen.descontarCapacidad(solicitudGuardada.getContarBolsas());
        aeropuertoRepository.save(origen);

        mejorRuta.reservarCapacidad(solicitudGuardada.getContarBolsas());
        guardarCapacidadesVuelos(mejorRuta);

        Ruta rutaGuardada = rutaRepository.save(mejorRuta);

        solicitudGuardada.setRuta(rutaGuardada);
        solicitudGuardada.setEstado(EstadoEnvio.COMPLETADO);
        return solicitudEnvioRepository.save(solicitudGuardada);
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
        Map<String, Integer> bolsasPorOrigen = new LinkedHashMap<>();

        for (SolicitudEnvio envio : envios) {
            if (envio.getOrigen() == null || envio.getOrigen().getCodigo() == null) {
                continue;
            }

            bolsasPorOrigen.merge(
                    envio.getOrigen().getCodigo(),
                    envio.getContarBolsas() != null ? envio.getContarBolsas() : 0,
                    Integer::sum
            );
        }

        Map<String, Double> ocupacion = new LinkedHashMap<>();
        for (Aeropuerto aeropuerto : aeropuertoRepository.findAll()) {
            int capacidadActual = aeropuerto.getCapacidad() != null ? aeropuerto.getCapacidad() : 0;
            int bolsasDespachadas = bolsasPorOrigen.getOrDefault(aeropuerto.getCodigo(), 0);
            int capacidadBaseAprox = capacidadActual + bolsasDespachadas;

            double porcentaje = capacidadBaseAprox <= 0
                    ? 0.0
                    : Math.min(100.0, (bolsasDespachadas * 100.0) / capacidadBaseAprox);

            ocupacion.put(aeropuerto.getCodigo(), porcentaje);
        }

        return ocupacion;
    }

    private List<MapaSimulacionEstado.VueloMapa> construirVuelosMapaOperacion(List<SolicitudEnvio> envios) {
        List<MapaSimulacionEstado.VueloMapa> vuelosMapa = new ArrayList<>();
        int minutoActualUtc = LocalTime.now(java.time.ZoneOffset.UTC).getHour() * 60
                + LocalTime.now(java.time.ZoneOffset.UTC).getMinute();

        for (SolicitudEnvio envio : envios) {
            if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
                continue;
            }

            int indice = 0;
            for (Vuelo vuelo : envio.getRuta().getVuelos()) {
                double progress = calcularProgress(minutoActualUtc, vuelo);
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

    private double calcularProgress(int minutoActualUtc, Vuelo vuelo) {
        int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        int llegada = vuelo.getLlegadaUtcMin() != null ? vuelo.getLlegadaUtcMin() : salida;

        if (llegada <= salida) {
            return minutoActualUtc >= llegada ? 1.0 : 0.0;
        }

        if (minutoActualUtc <= salida) {
            return 0.0;
        }

        if (minutoActualUtc >= llegada) {
            return 1.0;
        }

        return (minutoActualUtc - salida) / (double) (llegada - salida);
    }
}
