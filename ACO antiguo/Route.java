import java.util.ArrayList;
import java.util.List;

public class Route {
    private final List<Flight> flights;
    private double totalTime;
    private double cost;
    private boolean feasible;

    public Route() {
        this.flights = new ArrayList<>();
        this.totalTime = 0.0;
        this.cost = Double.MAX_VALUE;
        this.feasible = false;
    }

    public Route(Route other) {
        this.flights = new ArrayList<>(other.flights);
        this.totalTime = other.totalTime;
        this.cost = other.cost;
        this.feasible = other.feasible;
    }

    public void addFlight(Flight flight) {
        flights.add(flight);
        totalTime += flight.getTravelTimeDays();
    }

    public List<Flight> getFlights() {
        return flights;
    }

    public double getTotalTime() {
        return totalTime;
    }

    public double getCost() {
        return cost;
    }

    public boolean isFeasible() {
        return feasible;
    }

    public void evaluate(ShipmentRequest request) {
        boolean valid = !flights.isEmpty();

        Airport current = request.getOrigin();
        for (Flight f : flights) {
            if (!f.getFrom().equals(current)) {
                valid = false;
                break;
            }
            if (!f.hasCapacity(request.getBagCount())) {
                valid = false;
                break;
            }
            current = f.getTo();
        }

        if (!current.equals(request.getDestination())) {
            valid = false;
        }

        if (totalTime > request.getMaxTimeDays()) {
            valid = false;
        }

        this.feasible = valid;

        if (valid) {
            cost = totalTime;
        } else {
            cost = 1000000 + totalTime;
        }
    }

    public void reserveCapacity(int bags) {
        for (Flight f : flights) {
            f.reserve(bags);
        }
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (Flight f : flights) {
            sb.append(f.getFrom().getCode())
              .append(" -> ")
              .append(f.getTo().getCode())
              .append("\n");
        }
        sb.append("Tiempo total: ").append(totalTime).append(" días\n");
        sb.append("Factible: ").append(feasible).append("\n");
        sb.append("Costo: ").append(cost).append("\n");
        return sb.toString();
    }
}