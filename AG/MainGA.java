import java.nio.file.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainGA {

    public static void main(String[] args) {
        try {
            // ===== RUTA DE DATA =====
            Path dataDir = Path.of("data");

            // ===== CARGAR AEROPUERTOS =====
            Map<String, Airport> airportByCode = loadAirports(
                dataDir.resolve("c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt")
            );

            // ===== CARGAR VUELOS =====
            Graph graph = loadFlights(
                dataDir.resolve("planes_vuelo.txt"),
                airportByCode
            );

            // ===== GENERAR 20 SOLICITUDES =====
            List<ShipmentRequest> requests = new ArrayList<>();
            List<Airport> airports = new ArrayList<>(airportByCode.values());
            Random rand = new Random();

            for (int i = 0; i < 20; i++) {
                Airport origin = airports.get(rand.nextInt(airports.size()));
                Airport destination = airports.get(rand.nextInt(airports.size()));

                if (origin.equals(destination)) {
                    i--;
                    continue;
                }

                requests.add(new ShipmentRequest(origin, destination, 2, 2.0));
            }

            // ===== GA =====
            GeneticPlanner planner = new GeneticPlanner(
                graph,
                30,     // población
                60,     // generaciones
                0.85,   // crossover
                0.25,   // mutación
                3,      // torneo
                3       // escalas
            );

            int solved = 0;
            int notSolved = 0;

            // ===== PROCESAR LAS 20 SOLICITUDES =====
            for (int i = 0; i < requests.size(); i++) {

                ShipmentRequest req = requests.get(i);
                Route bestRoute = planner.findBestRoute(req);

                System.out.println("\n=== Solicitud " + (i + 1) + " ===");
                System.out.println("Origen: " + req.getOrigin().getCode() +
                        " | Destino: " + req.getDestination().getCode());

                if (bestRoute != null && bestRoute.isFeasible()) {
                    solved++;
                    System.out.println("RUTA ENCONTRADA:");
                    System.out.println(bestRoute);
                } else {
                    notSolved++;
                    System.out.println("No se encontró ruta");
                }
            }

            // ===== RESUMEN =====
            System.out.println("\n=== RESUMEN ===");
            System.out.println("Total: " + requests.size());
            System.out.println("Resueltas: " + solved);
            System.out.println("No resueltas: " + notSolved);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // =========================
    // CARGA DE AEROPUERTOS
    // =========================
    private static Map<String, Airport> loadAirports(Path airportsFile) throws IOException {
        Map<String, Airport> airportByCode = new HashMap<>();
        List<String> lines = Files.readAllLines(airportsFile, StandardCharsets.UTF_16);

        for (String line : lines) {
            String trimmed = line.trim();

            if (trimmed.isEmpty() || !trimmed.matches("^\\d{2}\\s+.*")) {
                continue;
            }

            String[] parts = trimmed.split("\\s+");
            if (parts.length < 7) continue;

            String code = parts[1];
            int gmtOffset = parseSignedInt(parts[5], 0);
            int capacity = parseSignedInt(parts[6], 0);

            String city = parts[2];
            String region = "N/A";

            airportByCode.put(code, new Airport(code, city, region, gmtOffset, capacity));
        }

        return airportByCode;
    }

    // =========================
    // CARGA DE VUELOS
    // =========================
    private static Graph loadFlights(Path file, Map<String, Airport> map) throws Exception {
        Graph graph = new Graph();
        List<String> lines = Files.readAllLines(file);

        for (String line : lines) {
            String[] p = line.split("-");
            if (p.length < 5) continue;

            Airport from = map.get(p[0]);
            Airport to = map.get(p[1]);

            if (from == null || to == null) continue;

            double time = computeDurationDays(p[2], p[3]);
            int cap = Integer.parseInt(p[4]);

            graph.addFlight(new Flight(from, to, time, cap));
        }

        return graph;
    }

    // =========================
    // CALCULAR TIEMPO
    // =========================
    private static double computeDurationDays(String dep, String arr) {
        String[] d = dep.split(":");
        String[] a = arr.split(":");

        int dm = Integer.parseInt(d[0]) * 60 + Integer.parseInt(d[1]);
        int am = Integer.parseInt(a[0]) * 60 + Integer.parseInt(a[1]);

        int diff = am - dm;
        if (diff <= 0) diff += 1440;

        return diff / 1440.0;
    }

    // =========================
    // PARSE SEGURO
    // =========================
    private static int parseSignedInt(String value, int fallback) {
        try {
            return Integer.parseInt(value.replace("+", "").trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}