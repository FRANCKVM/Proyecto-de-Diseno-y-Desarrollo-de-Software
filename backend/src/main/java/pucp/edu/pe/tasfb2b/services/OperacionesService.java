package pucp.edu.pe.tasfb2b.services;

import org.springframework.scheduling.annotation.Scheduled;
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
import pucp.edu.pe.tasfb2b.entities.VueloCancelacion;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.RutaRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloCancelacionRepository;
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
    private final VueloCancelacionRepository vueloCancelacionRepository;
    private final VueloCancelacionService vueloCancelacionService;
    private final EstadoLogisticoService estadoLogisticoService;

    public OperacionesService(
            GrafoService grafoService,
            AeropuertoRepository aeropuertoRepository,
            SolicitudEnvioRepository solicitudEnvioRepository,
            RutaRepository rutaRepository,
            VueloRepository vueloRepository,
            VueloCancelacionRepository vueloCancelacionRepository,
            VueloCancelacionService vueloCancelacionService,
            EstadoLogisticoService estadoLogisticoService
    ) {
        this.grafoService = grafoService;
        this.aeropuertoRepository = aeropuertoRepository;
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

        return resultados;
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

    private SolicitudEnvio procesarSolicitudReal(SolicitudEnvio solicitud) {
        validarSolicitud(solicitud);

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

        Ruta rutaDirecta = encontrarRutaDirectaFactible(solicitudGuardada);
        if (rutaDirecta != null) {
            return guardarRutaPlanificada(solicitudGuardada, rutaDirecta);
        }

        Grafo grafo = grafoService.construirGrafo();
        PlanificadorGenetico planificador = crearPlanificador(
                grafo,
                solicitudGuardada.getFechaHoraRegistro()
        );
        Ruta mejorRuta = planificador.encontrarMejorRuta(solicitudGuardada);

        if (mejorRuta == null || !mejorRuta.esFactible()) {
            solicitudGuardada.setEstado(EstadoEnvio.INGRESADO);
            return solicitudEnvioRepository.save(solicitudGuardada);
        }

        return guardarRutaPlanificada(solicitudGuardada, mejorRuta);
    }

    private SolicitudEnvio guardarRutaPlanificada(SolicitudEnvio solicitudGuardada, Ruta ruta) {
        Aeropuerto origen = solicitudGuardada.getOrigen();

        origen.descontarCapacidad(solicitudGuardada.getContarBolsas());
        aeropuertoRepository.save(origen);

        ruta.reservarCapacidad(solicitudGuardada.getContarBolsas());
        guardarCapacidadesVuelos(ruta);

        Ruta rutaGuardada = rutaRepository.save(ruta);

        solicitudGuardada.setRuta(rutaGuardada);
        solicitudGuardada.setEstado(EstadoEnvio.EN_PROCESO);
        return solicitudEnvioRepository.save(solicitudGuardada);
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
            if (envio.getRuta() == null
                    || envio.getEstado() == EstadoEnvio.COMPLETADO
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
        for (VentanaVueloOperacion ventana : calcularVentanasRutaOperacion(envio)) {
            if (ventana.vuelo().getIdVuelo().equals(cancelacion.getVuelo().getIdVuelo())
                    && ventana.fechaHoraSalida().equals(cancelacion.getFechaHoraSalida())
                    && ventana.fechaHoraSalida().isAfter(cancelacion.getFechaHoraCancelacion())) {
                return true;
            }
        }

        return false;
    }

    private List<VentanaVueloOperacion> calcularVentanasRutaOperacion(SolicitudEnvio envio) {
        List<VentanaVueloOperacion> ventanas = new ArrayList<>();
        if (envio.getRuta() == null || envio.getRuta().getVuelos() == null || envio.getFecha() == null) {
            return ventanas;
        }

        LocalDateTime fechaBase = envio.getFecha().atStartOfDay();
        int minutoReferencia = envio.getHora() != null
                ? envio.getHora().getHour() * 60 + envio.getHora().getMinute()
                : 0;

        for (Vuelo vuelo : envio.getRuta().getVuelos()) {
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
        Aeropuerto origen = envio.getOrigen();
        if (origen != null) {
            origen.aumentarCapacidad(envio.getContarBolsas());
            aeropuertoRepository.save(origen);
        }

        if (envio.getRuta() == null || envio.getRuta().getVuelos() == null) {
            return;
        }

        for (Vuelo vuelo : envio.getRuta().getVuelos()) {
            int capacidadUsada = vuelo.getCapacidadUsada() != null ? vuelo.getCapacidadUsada() : 0;
            vuelo.setCapacidadUsada(Math.max(0, capacidadUsada - envio.getContarBolsas()));
            vueloRepository.save(vuelo);
        }
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
}
