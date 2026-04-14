import java.util.*;

public class AntColonyOptimizer {

    private final Graph graph;
    private final Map<Flight, Double> pheromones = new HashMap<>();

    private final int ants = 40;
    private final int iterations = 100;

    private final double alpha = 1.0;
    private final double beta = 2.0;
    private final double evaporation = 0.5;

    public AntColonyOptimizer(Graph graph) {
        this.graph = graph;

        // Inicializar feromonas
        for (Airport a : graph.getAirports()) {
            for (Flight f : graph.getOutgoingFlights(a)) {
                pheromones.put(f, 1.0);
            }
        }
    }

    public Route run(ShipmentRequest request) {
        Route bestRoute = null;
        double bestCost = Double.MAX_VALUE;

        for (int iter = 0; iter < iterations; iter++) {

            List<Route> routes = new ArrayList<>();

            for (int i = 0; i < ants; i++) {
                Route r = construirRuta(request);
                r.evaluate(request);
                routes.add(r);

                if (r.isFeasible() && r.getCost() < bestCost) {
                    bestCost = r.getCost();
                    bestRoute = new Route(r);
                }
            }

            evaporar();
            actualizar(routes);
        }

        return bestRoute;
    }

    private Route construirRuta(ShipmentRequest request) {
        Route route = new Route();
        Airport current = request.getOrigin();
        Set<Airport> visited = new HashSet<>();

        while (!current.equals(request.getDestination())) {

            List<Flight> opciones = graph.getOutgoingFlights(current);
            List<Flight> validas = new ArrayList<>();

            for (Flight f : opciones) {
                if (!f.isCancelled() &&
                    f.hasCapacity(request.getBagCount()) &&
                    !visited.contains(f.getTo())) {
                    validas.add(f);
                }
            }

            if (validas.isEmpty()) {
				return new Route(); // fuerza a que sea no factible
			}

            Flight next = seleccionar(validas);
            route.addFlight(next);

            visited.add(current);
            current = next.getTo();
        }

        return route;
    }

    private Flight seleccionar(List<Flight> opciones) {
        double total = 0;

        for (Flight f : opciones) {
            double tau = pheromones.get(f);
            double eta = 1.0 / (f.getTravelTimeDays() + 0.1);
            total += Math.pow(tau, alpha) * Math.pow(eta, beta);
        }

        double rand = Math.random() * total;
        double acum = 0;

        for (Flight f : opciones) {
            double tau = pheromones.get(f);
            double eta = 1.0 / f.getTravelTimeDays();
            acum += Math.pow(tau, alpha) * Math.pow(eta, beta);

            if (rand <= acum) return f;
        }

        return opciones.get(0);
    }

    private void evaporar() {
        for (Flight f : pheromones.keySet()) {
            pheromones.put(f, pheromones.get(f) * (1 - evaporation));
        }
    }

    private void actualizar(List<Route> routes) {
        for (Route r : routes) {
            if (!r.isFeasible()) continue;

			double penalty = r.getFlights().size();
			double contrib = 1.0 / (r.getCost() * penalty);

            for (Flight f : r.getFlights()) {
                pheromones.put(f, pheromones.get(f) + contrib);
            }
        }
    }
}