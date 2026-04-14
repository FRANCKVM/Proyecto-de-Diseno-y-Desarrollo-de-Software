public class Main {
    public static void main(String[] args) {
        Airport lima = new Airport("LIM", "Lima", "America");
        Airport bogota = new Airport("BOG", "Bogota", "America");
        Airport madrid = new Airport("MAD", "Madrid", "Europe");
        Airport paris = new Airport("PAR", "Paris", "Europe");
        Airport tokyo = new Airport("TYO", "Tokyo", "Asia");

        Graph graph = new Graph();

        // mismo continente = 0.5 días
        // distinto continente = 1 día
        graph.addFlight(new Flight(lima, bogota, 0.5, 200));
        graph.addFlight(new Flight(bogota, lima, 0.5, 200));

        graph.addFlight(new Flight(madrid, paris, 0.5, 180));
        graph.addFlight(new Flight(paris, madrid, 0.5, 180));

        graph.addFlight(new Flight(lima, madrid, 1.0, 300));
        graph.addFlight(new Flight(bogota, madrid, 1.0, 250));
        graph.addFlight(new Flight(madrid, tokyo, 1.0, 250));
        graph.addFlight(new Flight(paris, tokyo, 1.0, 220));
        graph.addFlight(new Flight(bogota, paris, 1.0, 230));

        ShipmentRequest request = new ShipmentRequest(
                lima,
                tokyo,
                40,
                2.0
        );

        ACOPlanner planner = new ACOPlanner(
                graph,
                20,     // hormigas
                50,     // iteraciones
                1.0,    // alpha
                2.0,    // beta
                0.2,    // evaporación
                100.0,  // Q
                5       // máximo saltos
        );

        Route bestRoute = planner.findBestRoute(request);

        if (bestRoute != null && bestRoute.isFeasible()) {
            System.out.println("\n=== MEJOR RUTA ENCONTRADA ===");
            System.out.println(bestRoute);

            bestRoute.reserveCapacity(request.getBagCount());
        } else {
            System.out.println("No se encontró una ruta factible.");
        }
    }
}