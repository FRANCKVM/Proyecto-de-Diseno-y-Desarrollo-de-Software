package pucp.edu.pe.tasfb2b.services;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoEnvio;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.SolicitudEnvioRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloOcurrenciaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeguimientoServiceTest {

    @Mock private AsignacionEnvioRepository asignacionRepository;
    @Mock private SolicitudEnvioRepository solicitudRepository;
    @Mock private OperacionesService operacionesService;
    @Mock private SimulacionService simulacionService;
    @Mock private EstadoLogisticoService estadoLogisticoService;
    @Mock private VueloOcurrenciaRepository ocurrenciaRepository;
    @Mock private VueloOcurrenciaService ocurrenciaService;
    @Mock private EstadoSimulacion estadoSimulacion;
    private SeguimientoService service;

    @BeforeEach
    void setUp() {
        service = new SeguimientoService(
                asignacionRepository,
                solicitudRepository,
                operacionesService,
                simulacionService,
                estadoLogisticoService,
                ocurrenciaRepository,
                ocurrenciaService
        );
    }

    @Test
    void obtieneDetalleSimuladoDesdeMemoriaSinConsultarLaBaseDeDatos() {
        SolicitudEnvio envio = envio(-1);
        envio.setIdSimulacionVolatil(7);
        when(simulacionService.obtenerEnviosSimulacion(7)).thenReturn(List.of(envio));
        when(simulacionService.obtenerEstado(7)).thenReturn(estadoSimulacion);
        when(estadoSimulacion.isActiva()).thenReturn(true);
        when(estadoSimulacion.getPunteroConsumoMinutos()).thenReturn(0);

        var detalle = service.obtenerEnvioDetalle("ENV-SIM-001", 7);

        assertEquals("ENV-SIM-001", detalle.codigo());
        verify(solicitudRepository, never()).findById(any());
        verify(asignacionRepository, never()).findByEnvio_IdEnvioOrderByIdAsignacionAsc(any());
    }

    @Test
    void agrupaEnviosDelAlmacenConUnaConsultaPorIdsDeOcurrencia() {
        VueloOcurrencia ocurrencia = ocurrencia(101L);
        SolicitudEnvio envio = envio(15);
        Ruta ruta = new Ruta();
        ruta.setOcurrencias(List.of(ocurrencia));
        envio.setRuta(ruta);

        when(ocurrenciaRepository.findConectadasPorAeropuerto(any(), any(), any()))
                .thenReturn(List.of(ocurrencia));
        when(solicitudRepository.findByOcurrenciaIds(anyList())).thenReturn(List.of(envio));
        when(asignacionRepository.findByOcurrenciaIds(anyList())).thenReturn(List.of());

        LocalDate fecha = LocalDate.of(2026, 7, 11);
        var vuelos = service.listarVuelosPorAeropuerto("SPIM", null, fecha);

        assertEquals(1, vuelos.size());
        assertEquals(1, vuelos.getFirst().envios().size());
        verify(ocurrenciaRepository).findConectadasPorAeropuerto(
                "SPIM", fecha.atStartOfDay(), fecha.plusDays(1).atStartOfDay()
        );
        verify(solicitudRepository).findByOcurrenciaIds(List.of(101L));
        verify(asignacionRepository).findByOcurrenciaIds(List.of(101L));
    }

    @Test
    void listaSoloElDiaSolicitadoEnOperacion() {
        LocalDate fecha = LocalDate.of(2026, 7, 12);
        VueloOcurrencia ocurrencia = ocurrencia(102L);
        ocurrencia.setFechaHoraSalida(fecha.atTime(10, 0));
        ocurrencia.setFechaHoraLlegada(fecha.atTime(12, 0));
        when(ocurrenciaService.listarOperativas(
                fecha.atStartOfDay(), fecha.plusDays(1).atStartOfDay()
        )).thenReturn(List.of(ocurrencia));

        var vuelos = service.listarOcurrencias(null, fecha);

        assertEquals(1, vuelos.size());
        verify(ocurrenciaService).listarOperativas(
                fecha.atStartOfDay(), fecha.plusDays(1).atStartOfDay()
        );
    }

    @Test
    void solicitaSoloElDiaIndicadoAlaSimulacion() {
        LocalDate fecha = LocalDate.of(2026, 7, 11);
        VueloOcurrencia primerDia = ocurrencia(-1L);
        when(simulacionService.listarOcurrenciasSimuladas(7, fecha))
                .thenReturn(List.of(primerDia));

        var vuelos = service.listarOcurrencias(7, fecha);

        assertEquals(1, vuelos.size());
        assertEquals(-1L, vuelos.getFirst().idOcurrencia());
        verify(simulacionService).listarOcurrenciasSimuladas(7, fecha);
    }

    private SolicitudEnvio envio(int id) {
        Aeropuerto origen = aeropuerto("SPIM");
        Aeropuerto destino = aeropuerto("SABE");
        SolicitudEnvio envio = new SolicitudEnvio(
                id, LocalDate.of(2026, 7, 11), LocalTime.NOON, 1,
                origen, destino, 16, 2.0
        );
        envio.setEstado(EstadoEnvio.REGISTRADO);
        return envio;
    }

    private VueloOcurrencia ocurrencia(long id) {
        Vuelo vuelo = new Vuelo(aeropuerto("SPIM"), aeropuerto("SABE"), null, 100, 600, 720);
        vuelo.setIdVuelo(25);
        VueloOcurrencia ocurrencia = new VueloOcurrencia(
                vuelo,
                LocalDateTime.of(2026, 7, 11, 10, 0),
                LocalDateTime.of(2026, 7, 11, 12, 0),
                100
        );
        ocurrencia.setIdOcurrencia(id);
        return ocurrencia;
    }

    private Aeropuerto aeropuerto(String codigo) {
        Aeropuerto aeropuerto = new Aeropuerto();
        aeropuerto.setCodigo(codigo);
        aeropuerto.setRegion("AMERICA_SUR");
        return aeropuerto;
    }
}
