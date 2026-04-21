import java.util.*;

public class Grafo {
    private final Map<Aeropuerto, List<Vuelo>> adyacencia;

    public Grafo() {
        this.adyacencia = new HashMap<>();
    }

    public void addAirport(Aeropuerto aeropuerto) {
        adyacencia.putIfAbsent(aeropuerto, new ArrayList<>());
    }

    public void addFlight(Vuelo vuelo) {
        addAirport(vuelo.getDesde());
        addAirport(vuelo.getHasta());
        adyacencia.get(vuelo.getDesde()).add(vuelo);
    }

    public List<Vuelo> getOutgoingFlights(Aeropuerto aeropuerto) {
        return adyacencia.getOrDefault(aeropuerto, Collections.emptyList());
    }

    public Set<Aeropuerto> getAirports() {
        return adyacencia.keySet();
    }
}
