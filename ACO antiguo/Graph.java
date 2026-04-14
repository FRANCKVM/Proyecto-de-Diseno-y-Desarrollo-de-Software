import java.util.*;

public class Graph {
    private final Map<Airport, List<Flight>> adjacency;

    public Graph() {
        this.adjacency = new HashMap<>();
    }

    public void addAirport(Airport airport) {
        adjacency.putIfAbsent(airport, new ArrayList<>());
    }

    public void addFlight(Flight flight) {
        addAirport(flight.getFrom());
        addAirport(flight.getTo());
        adjacency.get(flight.getFrom()).add(flight);
    }

    public List<Flight> getOutgoingFlights(Airport airport) {
        return adjacency.getOrDefault(airport, Collections.emptyList());
    }

    public Set<Airport> getAirports() {
        return adjacency.keySet();
    }
}