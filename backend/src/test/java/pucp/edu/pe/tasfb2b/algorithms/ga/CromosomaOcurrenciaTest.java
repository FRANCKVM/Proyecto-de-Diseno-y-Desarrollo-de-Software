package pucp.edu.pe.tasfb2b.algorithms.ga;

import org.junit.jupiter.api.Test;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CromosomaOcurrenciaTest {

    @Test
    void seleccionaLaOcurrenciaExactaDisponibleSinReconstruirElDia() {
        Aeropuerto origen = aeropuerto("SPIM");
        Aeropuerto destino = aeropuerto("SABE");
        Vuelo plantilla = new Vuelo(origen, destino, 2.0 / 24.0, 100, 8 * 60, 10 * 60);
        plantilla.setIdVuelo(7);

        VueloOcurrencia cancelada = ocurrencia(1L, plantilla, LocalDate.of(2026, 7, 11).atTime(10, 0));
        cancelada.setEstado(EstadoVueloOcurrencia.CANCELADO);
        VueloOcurrencia siguienteDia = ocurrencia(2L, plantilla, LocalDate.of(2026, 7, 12).atTime(8, 0));

        Grafo grafo = new Grafo();
        grafo.agregarOcurrencia(cancelada);
        grafo.agregarOcurrencia(siguienteDia);
        SolicitudEnvio solicitud = new SolicitudEnvio(
                1, LocalDate.of(2026, 7, 11), LocalTime.of(9, 0), 1,
                origen, destino, 20, 2.0
        );

        Cromosoma cromosoma = new Cromosoma(List.of(origen, destino));
        cromosoma.evaluar(grafo, solicitud, solicitud.getFechaHoraRegistro());

        assertTrue(cromosoma.esFactible());
        assertEquals(2L, cromosoma.obtenerRuta().getOcurrencias().getFirst().getIdOcurrencia());
    }

    private Aeropuerto aeropuerto(String codigo) {
        Aeropuerto aeropuerto = new Aeropuerto();
        aeropuerto.setCodigo(codigo);
        return aeropuerto;
    }

    private VueloOcurrencia ocurrencia(Long id, Vuelo vuelo, LocalDateTime salida) {
        VueloOcurrencia ocurrencia = new VueloOcurrencia(vuelo, salida, salida.plusHours(2), 100);
        ocurrencia.setIdOcurrencia(id);
        return ocurrencia;
    }
}
