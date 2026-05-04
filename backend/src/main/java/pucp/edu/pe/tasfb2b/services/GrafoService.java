package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

@Service
public class GrafoService {

    private final AeropuertoRepository aeropuertoRepository;
    private final VueloRepository vueloRepository;

    public GrafoService(
            AeropuertoRepository aeropuertoRepository,
            VueloRepository vueloRepository
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.vueloRepository = vueloRepository;
    }

    public Grafo construirGrafo() {
        Grafo grafo = new Grafo();

        aeropuertoRepository.findAll()
                .forEach(grafo::agregarAeropuerto);

        vueloRepository.findByCancelado(false)
                .forEach(grafo::agregarVuelo);

        return grafo;
    }

    public Grafo construirGrafoConTodosLosVuelos() {
        Grafo grafo = new Grafo();

        aeropuertoRepository.findAll()
                .forEach(grafo::agregarAeropuerto);

        for (Vuelo vuelo : vueloRepository.findAll()) {
            grafo.agregarVuelo(vuelo);
        }

        return grafo;
    }
}