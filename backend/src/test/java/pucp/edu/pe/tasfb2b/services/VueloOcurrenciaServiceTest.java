package pucp.edu.pe.tasfb2b.services;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import jakarta.persistence.Version;
import org.mockito.junit.jupiter.MockitoExtension;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;
import pucp.edu.pe.tasfb2b.repositories.VueloOcurrenciaRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VueloOcurrenciaServiceTest {

    @Mock private VueloRepository vueloRepository;
    @Mock private VueloOcurrenciaRepository ocurrenciaRepository;
    private VueloOcurrenciaService service;

    @BeforeEach
    void setUp() {
        service = new VueloOcurrenciaService(vueloRepository, ocurrenciaRepository);
    }

    @Test
    void generaCincoOcurrenciasPorPlantillaIncluyendoVuelosVacios() {
        Vuelo vuelo = vuelo(10, 8 * 60, 10 * 60, 120);
        when(vueloRepository.findAll()).thenReturn(List.of(vuelo));
        when(ocurrenciaRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        when(ocurrenciaRepository.findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()
        )).thenReturn(List.of());

        List<VueloOcurrencia> creadas = service.completarVentanaOperativa(LocalDate.of(2026, 7, 11));

        assertEquals(5, creadas.size());
        assertEquals(LocalDate.of(2026, 7, 11), creadas.getFirst().getFechaHoraSalida().toLocalDate());
        assertEquals(LocalDate.of(2026, 7, 15), creadas.getLast().getFechaHoraSalida().toLocalDate());
        assertEquals(0, creadas.getFirst().getCapacidadUsada());
    }

    @Test
    void conservaLaLlegadaDelDiaSiguiente() {
        Vuelo vuelo = vuelo(11, 23 * 60, 2 * 60, 100);
        VueloOcurrencia ocurrencia = service.crearOcurrenciaVolatil(
                vuelo,
                LocalDate.of(2026, 7, 11).atTime(23, 0)
        );

        assertEquals(LocalDate.of(2026, 7, 12), ocurrencia.getFechaHoraLlegada().toLocalDate());
        assertEquals(2, ocurrencia.getFechaHoraLlegada().getHour());
    }

    @Test
    void laCapacidadEsIndependienteEntreDias() {
        Vuelo vuelo = vuelo(12, 8 * 60, 10 * 60, 100);
        VueloOcurrencia hoy = service.crearOcurrenciaVolatil(vuelo, LocalDate.of(2026, 7, 11).atTime(8, 0));
        VueloOcurrencia manana = service.crearOcurrenciaVolatil(vuelo, LocalDate.of(2026, 7, 12).atTime(8, 0));

        hoy.reservar(40);

        assertNotSame(hoy, manana);
        assertEquals(40, hoy.getCapacidadUsada());
        assertEquals(0, manana.getCapacidadUsada());
    }

    @Test
    void marcaEnVueloAunqueLaOcurrenciaEsteVacia() {
        Vuelo vuelo = vuelo(13, 3 * 60, 6 * 60, 100);
        VueloOcurrencia ocurrencia = service.crearOcurrenciaVolatil(
                vuelo,
                LocalDate.of(2026, 7, 11).atTime(3, 0)
        );

        service.actualizarEstadoTemporal(
                ocurrencia,
                LocalDateTime.of(2026, 7, 11, 5, 0)
        );

        assertEquals(0, ocurrencia.getCapacidadUsada());
        assertEquals(EstadoVueloOcurrencia.EN_VUELO, ocurrencia.getEstado());
    }

    @Test
    void protegeLaCapacidadPersistidaConVersionOptimista() throws NoSuchFieldException {
        assertTrue(VueloOcurrencia.class.getDeclaredField("version").isAnnotationPresent(Version.class));
    }

    private Vuelo vuelo(int id, int salida, int llegada, int capacidad) {
        Aeropuerto origen = new Aeropuerto();
        origen.setCodigo("SPIM");
        Aeropuerto destino = new Aeropuerto();
        destino.setCodigo("SABE");
        Vuelo vuelo = new Vuelo(origen, destino, null, capacidad, salida, llegada);
        vuelo.setIdVuelo(id);
        return vuelo;
    }
}
