import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

public class Ant {
    private final Graph graph;
    private final ShipmentRequest request;
    private final double[][] pheromones;
    private final List<Airport> airportIndex;
    private final double alpha;
    private final double beta;
    private final Random random;

    public Ant(Graph graph,
               ShipmentRequest request,
               double[][] pheromones,
               List<Airport> airportIndex,
               double alpha,
               double beta) {
        this.graph = graph;
        this.request = request;
        this.pheromones = pheromones;
        this.airportIndex = airportIndex;
        this.alpha = alpha;
        this.beta = beta;
        this.random = new Random();
    }

    public Route buildRoute(int maxHops) {
        Route route = new Route();
        Airport current = request.getOrigin();
        Set<Airport> visited = new HashSet<>();
        visited.add(current);

        int hops = 0;

        while (!current.equals(request.getDestination()) && hops < maxHops) {
            List<Flight> candidates = graph.getOutgoingFlights(current).stream()
				.filter(f -> !f.isCancelled())
				.filter(f -> f.hasCapacity(request.getBagCount()))
				.filter(f -> !visited.contains(f.getTo()))
				.filter(f -> route.getTotalTime() + f.getTravelTimeDays() <= request.getMaxTimeDays())
				.toList();

            if (candidates.isEmpty()) {
                break;
            }

            Flight selected = selectNextFlight(current, candidates);
            if (selected == null) {
                break;
            }
			

            route.addFlight(selected);
            current = selected.getTo();
            visited.add(current);
            hops++;
        }

        route.evaluate(request);
        return route;
    }

    private Flight selectNextFlight(Airport current, List<Flight> candidates) {
        int i = airportIndex.indexOf(current);

        double[] probabilities = new double[candidates.size()];
        double sum = 0.0;

        for (int k = 0; k < candidates.size(); k++) {
            Flight f = candidates.get(k);
            int j = airportIndex.indexOf(f.getTo());
			
			if (f.getTravelTimeDays() <= 0) continue;

            double tau = Math.pow(pheromones[i][j], alpha);
            double eta = Math.pow(1.0 / (f.getTravelTimeDays() * (1 + 0.2 * candidates.size())), beta);

            probabilities[k] = tau * eta;
            sum += probabilities[k];
        }

        if (sum == 0.0) {
            return candidates.get(random.nextInt(candidates.size()));
        }

        double r = random.nextDouble() * sum;
        double cumulative = 0.0;

        for (int k = 0; k < candidates.size(); k++) {
            cumulative += probabilities[k];
            if (r <= cumulative) {
                return candidates.get(k);
            }
        }

        return candidates.get(candidates.size() - 1);
    }
}