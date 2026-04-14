import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Chromosome {
    private final List<Airport> genes;
    private double fitness;
    private Route route;
    private boolean feasible;

    public Chromosome() {
        this.genes = new ArrayList<>();
        this.fitness = Double.MAX_VALUE;
        this.route = new Route();
        this.feasible = false;
    }

    public Chromosome(List<Airport> genes) {
        this.genes = new ArrayList<>(genes);
        this.fitness = Double.MAX_VALUE;
        this.route = new Route();
        this.feasible = false;
    }

    public Chromosome(Chromosome other) {
        this.genes = new ArrayList<>(other.genes);
        this.fitness = other.fitness;
        this.route = new Route(other.route);
        this.feasible = other.feasible;
    }

    public List<Airport> getGenes() {
        return genes;
    }

    public double getFitness() {
        return fitness;
    }

    public Route getRoute() {
        return route;
    }

    public boolean isFeasible() {
        return feasible;
    }

    public void setGene(int index, Airport airport) {
        genes.set(index, airport);
    }

    public void addGene(Airport airport) {
        genes.add(airport);
    }

    public boolean containsAirport(Airport airport) {
        return genes.contains(airport);
    }

    public void evaluate(Graph graph, ShipmentRequest request) {
        Route candidateRoute = new Route();
        boolean valid = true;

        if (genes.size() < 2) {
            this.fitness = 1_000_000;
            this.feasible = false;
            this.route = candidateRoute;
            return;
        }

        if (!genes.get(0).equals(request.getOrigin()) ||
            !genes.get(genes.size() - 1).equals(request.getDestination())) {
            this.fitness = 1_000_000;
            this.feasible = false;
            this.route = candidateRoute;
            return;
        }

        Set<Airport> visited = new HashSet<>();

        for (int i = 0; i < genes.size() - 1; i++) {
            Airport from = genes.get(i);
            Airport to = genes.get(i + 1);

            if (visited.contains(from) && i > 0) {
                valid = false;
                break;
            }
            visited.add(from);

            Flight flight = findFlight(graph, from, to, request.getBagCount());
            if (flight == null) {
                valid = false;
                break;
            }

            candidateRoute.addFlight(flight);
        }

        candidateRoute.evaluate(request);

        if (!candidateRoute.isFeasible()) {
            valid = false;
        }

        this.route = candidateRoute;
        this.feasible = valid;

        if (valid) {
            this.fitness = candidateRoute.getTotalTime();
        } else {
            this.fitness = 1_000_000 + candidateRoute.getTotalTime();
        }
    }

    private Flight findFlight(Graph graph, Airport from, Airport to, int bags) {
        for (Flight flight : graph.getOutgoingFlights(from)) {
            if (flight.getTo().equals(to) &&
                !flight.isCancelled() &&
                flight.hasCapacity(bags)) {
                return flight;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Cromosoma: ");
        for (Airport airport : genes) {
            sb.append(airport.getCode()).append(" ");
        }
        sb.append("\nFitness: ").append(fitness);
        sb.append("\nFactible: ").append(feasible).append("\n");
        return sb.toString();
    }
}