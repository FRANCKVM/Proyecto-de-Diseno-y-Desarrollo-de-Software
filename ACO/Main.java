import java.nio.file.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Main {

    public static void main(String[] args) {
        try {
            // ===== RUTA DE DATA =====
            Path dirDatos = Path.of("data");

            // ===== CARGAR AEROPUERTOS =====
            Map<String, Aeropuerto> aeropuertoPorCodigo = cargarAeropuertos(
                dirDatos.resolve("c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt")
            );

            // ===== CARGAR VUELOS =====
            Grafo grafo = cargarVuelos(
                dirDatos.resolve("planes_vuelo.txt"),
                aeropuertoPorCodigo
            );

            // ===== GENERAR 20 SOLICITUDES =====
            List<SolicitudEnvio> solicitudes = new ArrayList<>();
            List<Aeropuerto> aeropuertos = new ArrayList<>(aeropuertoPorCodigo.values());
            Random aleatorio = new Random();

            for (int i = 0; i < 20; i++) {
                Aeropuerto origen = aeropuertos.get(aleatorio.nextInt(aeropuertos.size()));
                Aeropuerto destino = aeropuertos.get(aleatorio.nextInt(aeropuertos.size()));

                if (origen.equals(destino)) {
                    i--;
                    continue;
                }

                solicitudes.add(new SolicitudEnvio(origen, destino, 2, 2.0));
            }

            // ===== ACO =====
            PlanificadorACO planificador = new PlanificadorACO(
                grafo,
                20,     // hormigas
                50,     // iteraciones
                1.0,
                2.0,
                0.2,
                100.0,
                20      // saltos máximos
            );

            int resueltas = 0;
            int noResueltas = 0;

            // ===== PROCESAR LAS 20 SOLICITUDES =====
            for (int i = 0; i < solicitudes.size(); i++) {

                SolicitudEnvio solicitud = solicitudes.get(i);
                Ruta mejorRuta = planificador.encontrarMejorRuta(solicitud);

                System.out.println("\n=== Solicitud " + (i + 1) + " ===");
                System.out.println("Origen: " + solicitud.getOrigen().getCodigo() +
                        " | Destino: " + solicitud.getDestino().getCodigo());

                if (mejorRuta != null && mejorRuta.esFactible()) {
                    resueltas++;
                    System.out.println("RUTA ENCONTRADA:");
                    System.out.println(mejorRuta);
                } else {
                    noResueltas++;
                    System.out.println("No se encontró ruta");
                }
            }

            // ===== RESUMEN =====
            System.out.println("\n=== RESUMEN ===");
            System.out.println("Total: " + solicitudes.size());
            System.out.println("Resueltas: " + resueltas);
            System.out.println("No resueltas: " + noResueltas);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // =========================
    // CARGA DE AEROPUERTOS
    // =========================
    private static Map<String, Aeropuerto> cargarAeropuertos(Path archivoAeropuertos) throws IOException {
        Map<String, Aeropuerto> aeropuertoPorCodigo = new HashMap<>();
        List<String> lineas = Files.readAllLines(archivoAeropuertos, StandardCharsets.UTF_16);

        for (String linea : lineas) {
            String ajustada = linea.trim();

            if (ajustada.isEmpty() || !ajustada.matches("^\\d{2}\\s+.*")) {
                continue;
            }

            String[] partes = ajustada.split("\\s+");
            if (partes.length < 7) continue;

            String codigo = partes[1];
            int desplazamientoGMT = parseIntSinSigno(partes[5], 0);
            int capacidad = parseIntSinSigno(partes[6], 0);

            String ciudad = partes[2];
            String region = "N/A";

            aeropuertoPorCodigo.put(codigo, new Aeropuerto(codigo, ciudad, region, desplazamientoGMT, capacidad));
        }

        return aeropuertoPorCodigo;
    }

    // =========================
    // CARGA DE VUELOS
    // =========================
    private static Grafo cargarVuelos(Path archivo, Map<String, Aeropuerto> mapa) throws Exception {
        Grafo grafo = new Grafo();
        List<String> lineas = Files.readAllLines(archivo);

        for (String linea : lineas) {
            String[] p = linea.split("-");
            if (p.length < 5) continue;

            Aeropuerto desde = mapa.get(p[0]);
            Aeropuerto hasta = mapa.get(p[1]);

            if (desde == null || hasta == null) continue;

            double tiempo = calcularDuracionDias(p[2], p[3]);
            int capacidad = Integer.parseInt(p[4]);

            grafo.agregarVuelo(new Vuelo(desde, hasta, tiempo, capacidad));
        }

        return grafo;
    }

    // =========================
    // CALCULAR TIEMPO
    // =========================
    private static double calcularDuracionDias(String salida, String llegada) {
        String[] d = salida.split(":");
        String[] a = llegada.split(":");

        int dm = Integer.parseInt(d[0]) * 60 + Integer.parseInt(d[1]);
        int am = Integer.parseInt(a[0]) * 60 + Integer.parseInt(a[1]);

        int diferencia = am - dm;
        if (diferencia <= 0) diferencia += 1440;

        return diferencia / 1440.0;
    }

    // =========================
    // PARSE SEGURO
    // =========================
    private static int parseIntSinSigno(String valor, int predeterminado) {
        try {
            return Integer.parseInt(valor.replace("+", "").trim());
        } catch (NumberFormatException e) {
            return predeterminado;
        }
    }
}