package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloOcurrenciaRepository;

import java.time.LocalDateTime;

@Service
public class GrafoService {
    private final AeropuertoRepository aeropuertoRepository;
    private final VueloOcurrenciaRepository ocurrenciaRepository;

    public GrafoService(
            AeropuertoRepository aeropuertoRepository,
            VueloOcurrenciaRepository ocurrenciaRepository
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.ocurrenciaRepository = ocurrenciaRepository;
    }

    @Transactional(readOnly = true)
    public Grafo construirGrafo(LocalDateTime desde, LocalDateTime hasta) {
        Grafo grafo = new Grafo();
        aeropuertoRepository.findAll().forEach(grafo::agregarAeropuerto);
        ocurrenciaRepository
                .findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(desde, hasta)
                .forEach(grafo::agregarOcurrencia);
        return grafo;
    }
}
