import java.util.ArrayList;
import java.util.List;

public class ACOPlanner {
    private final Graph graph;
    private final List<Airport> airportIndex;
    private final double[][] pheromones;

    private final int antCount;
    private final int iterations;
    private final double alpha;
    private final double beta;
    private final double evaporation;
    private final double q;
    private final int maxHops;

    public ACOPlanner(Graph graph,
                      int antCount,
                      int iterations,
                      double alpha,
                      double beta,
                      double evaporation,
                      double q,
                      int maxHops) {
        this.graph = graph;
        this.antCount = antCount;
        this.iterations = iterations;
        this.alpha = alpha;
        this.beta = beta;
        this.evaporation = evaporation;
        this.q = q;
        this.maxHops = maxHops;

        this.airportIndex = new ArrayList<>(graph.getAirports());
        int n = airportIndex.size();
        this.pheromones = new double[n][n];

        initializePheromones();
    }

    private void initializePheromones() {
        for (int i = 0; i < pheromones.length; i++) {
            for (int j = 0; j < pheromones[i].length; j++) {
                pheromones[i][j] = 1.0;
            }
        }
    }

    public Route findBestRoute(ShipmentRequest request) {
        Route globalBest = null;

        for (int iter = 0; iter < iterations; iter++) {
            List<Route> routes = new ArrayList<>();
            Route iterationBest = null;

            for (int k = 0; k < antCount; k++) {
                Ant ant = new Ant(graph, request, pheromones, airportIndex, alpha, beta);
                Route route = ant.buildRoute(maxHops);
                routes.add(route);

                if (iterationBest == null || route.getCost() < iterationBest.getCost()) {
                    iterationBest = route;
                }
            }

            evaporate();

            for (Route route : routes) {
                if (route.isFeasible()) {
                    deposit(route);
                }
            }

            if (iterationBest != null &&
                (globalBest == null || iterationBest.getCost() < globalBest.getCost())) {
                globalBest = new Route(iterationBest);
            }

            System.out.println("Iteración " + (iter + 1) +
                    " | mejor costo: " + (iterationBest != null ? iterationBest.getCost() : "N/A"));
        }

        return globalBest;
    }

    private void evaporate() {
        for (int i = 0; i < pheromones.length; i++) {
            for (int j = 0; j < pheromones[i].length; j++) {
                pheromones[i][j] *= (1.0 - evaporation);
                if (pheromones[i][j] < 0.0001) {
                    pheromones[i][j] = 0.0001;
                }
            }
        }
    }

    private void deposit(Route route) {
        double contribution = q / route.getCost();

        for (Flight f : route.getFlights()) {
            int i = airportIndex.indexOf(f.getFrom());
            int j = airportIndex.indexOf(f.getTo());
            pheromones[i][j] += contribution;
        }
    }
}