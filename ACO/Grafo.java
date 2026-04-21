import java.util.*;

public class Grafo {
    private final Map<Aeropuerto, List<Vuelo>> adyacencia;

    public Grafo() {
        this.adyacencia = new HashMap<>();
    }

    public void agregarAeropuerto(Aeropuerto aeropuerto) {
        adyacencia.putIfAbsent(aeropuerto, new ArrayList<>());
    }

    public void agregarVuelo(Vuelo vuelo) {
        agregarAeropuerto(vuelo.getDesde());
        agregarAeropuerto(vuelo.getHasta());
        adyacencia.get(vuelo.getDesde()).add(vuelo);
    }

    public List<Vuelo> getVuelosSalientes(Aeropuerto aeropuerto) {
        return adyacencia.getOrDefault(aeropuerto, Collections.emptyList());
    }

    public Set<Aeropuerto> getAeropuertos() {
        return adyacencia.keySet();
    }
}
