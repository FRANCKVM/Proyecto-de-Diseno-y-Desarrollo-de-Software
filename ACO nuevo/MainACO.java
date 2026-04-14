import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class MainACO {

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT);

    public static void main(String[] args) {

        Path dataDir = Path.of(args.length > 0 ? args[0] : "data");
        double defaultMaxTimeDays = args.length > 2 ? Double.parseDouble(args[2]) : 2.0;
        int maxRequests = args.length > 3 ? Integer.parseInt(args[3]) : 20;

        try {
            // ===== AEROPUERTOS =====
            Map<String, Airport> airportByCode = loadAirports(
                    dataDir.resolve("c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt")
            );

            // ===== VUELOS =====
            Graph graph = loadFlights(dataDir.resolve("planes_vuelo.txt"), airportByCode);

            // ===== ENVIOS =====
            Path shipmentsDir = dataDir.resolve("_envios_preliminar");

            Path shipmentFile = args.length > 1
                    ? shipmentsDir.resolve(args[1])
                    : Files.list(shipmentsDir)
                           .filter(p -> p.getFileName().toString().startsWith("_envios_"))
                           .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                           .findFirst()
                           .orElseThrow(() -> new IllegalStateException("No hay archivos de envios"));

            String originCode = extractOriginCodeFromFileName(shipmentFile.getFileName().toString());
            Airport origin = airportByCode.get(originCode);

            List<ShipmentRequest> requests = loadShipmentRequests(
                    shipmentFile,
                    origin,
                    airportByCode,
                    defaultMaxTimeDays,
                    maxRequests
            );

            if (requests.isEmpty()) {
                System.out.println("No hay solicitudes");
                return;
            }

            // ===== ACO =====
            AntColonyOptimizer aco = new AntColonyOptimizer(graph);

            int solved = 0;
            int notSolved = 0;

            for (int i = 0; i < requests.size(); i++) {

                ShipmentRequest request = requests.get(i);
                Route bestRoute = aco.run(request);

                System.out.println("\n=== Solicitud " + (i + 1) + " ===");
                System.out.println("Origen: " + request.getOrigin().getCode() +
                        " | Destino: " + request.getDestination().getCode() +
                        " | Bolsas: " + request.getBagCount());

                if (bestRoute != null && bestRoute.isFeasible()) {
                    solved++;
                    System.out.println("RUTA ENCONTRADA (ACO):");
                    System.out.println(bestRoute);
                    bestRoute.reserveCapacity(request.getBagCount());
                } else {
                    notSolved++;
                    System.out.println("No se encontro ruta con ACO");
                }
            }

            System.out.println("\n=== RESUMEN ===");
            System.out.println("Total: " + requests.size());
            System.out.println("Resueltas: " + solved);
            System.out.println("No resueltas: " + notSolved);

        } catch (Exception e) {
            System.err.println("ERROR ACO: " + e.getMessage());
            e.printStackTrace();
        }
    }
	
	private static int parseSignedInt(String value, int fallback) {
		try {
			return Integer.parseInt(value.replace("+", "").trim());
		} catch (NumberFormatException e) {
			return fallback;
		}
	}

    // ===== FUNCIONES (COPIADAS DEL GA) =====

	private static Map<String, Airport> loadAirports(Path airportsFile) throws IOException {
		Map<String, Airport> airportByCode = new HashMap<>();
		List<String> lines = Files.readAllLines(airportsFile, StandardCharsets.UTF_16);

		for (String line : lines) {
			String trimmed = line.trim();

			if (trimmed.isEmpty() || !trimmed.matches("^\\d{2}\\s+.*")) {
				continue;
			}

			String[] parts = trimmed.split("\\s+");
			if (parts.length < 7) {
				continue;
			}

			String code = parts[1];
			int gmtOffset = parseSignedInt(parts[5], 0);
			int capacity = parseSignedInt(parts[6], 0);

			String city = parts[2];
			String region = "N/A";

			Airport airport = new Airport(code, city, region, gmtOffset, capacity);
			airportByCode.put(code, airport);
		}

		return airportByCode;
	}

    private static Graph loadFlights(Path file, Map<String, Airport> map) throws IOException {
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

    private static List<ShipmentRequest> loadShipmentRequests(
            Path file,
            Airport origin,
            Map<String, Airport> map,
            double maxTime,
            int max
    ) throws IOException {

        List<ShipmentRequest> list = new ArrayList<>();
        List<String> lines = Files.readAllLines(file);

        for (String line : lines) {
            if (list.size() >= max) break;

            String[] p = line.split("-");
            if (p.length < 7) continue;

            Airport dest = map.get(p[4]);
            int bags = Integer.parseInt(p[5]);

            if (dest == null || bags <= 0) continue;

            list.add(new ShipmentRequest(origin, dest, bags, maxTime));
        }

        return list;
    }

    private static String extractOriginCodeFromFileName(String name) {
        return name.replace("_envios_", "").replace("_.txt", "");
    }

    private static double computeDurationDays(String dep, String arr) {
        LocalTime d = LocalTime.parse(dep, HHMM);
        LocalTime a = LocalTime.parse(arr, HHMM);

        int dm = d.getHour() * 60 + d.getMinute();
        int am = a.getHour() * 60 + a.getMinute();

        int diff = am - dm;
        if (diff <= 0) diff += 1440;

        return diff / 1440.0;
    }
}