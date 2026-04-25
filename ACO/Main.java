import java.nio.file.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Main {

    public static void main(String[] args) {
		try {
			Path dirDatos = Path.of("data");

			Map<String, Aeropuerto> aeropuertoPorCodigo = cargarAeropuertos(
					dirDatos.resolve("c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt")
			);

			Grafo grafo = cargarVuelos(
					dirDatos.resolve("planes_vuelo.txt"),
					aeropuertoPorCodigo
			);

			// CARGAR ENVÍOS REALES
			List<SolicitudEnvio> solicitudes = cargarEnvios(
					dirDatos.resolve("_envios_preliminar_/_envios_SBBR_.txt"),
					aeropuertoPorCodigo, "SBBR"
			);

			PlanificadorACO planificador = new PlanificadorACO(
					grafo, 20, 50, 1.0, 2.0, 0.2, 100.0, 20
			); //20, 50, ...

			// ===============================
			// SIMULACIÓN POR DÍAS
			// ===============================
			for (int dia = 1; dia <= 3; dia++) {
				System.out.println("\n=====================");
				System.out.println("DÍA " + dia);
				System.out.println("=====================");
				int resueltas = 0;
				int noResueltas = 0;
				double tiempoTotal = 0;
				
				
				for (SolicitudEnvio s : solicitudes) {

					Ruta r = planificador.encontrarMejorRuta(s);

					if (r != null && r.esFactible()) {
						resueltas++;
						tiempoTotal += r.getTiempoTotal();
						
						// reservar vuelos
						r.reservarCapacidad(s.getContarBolsas());

						//  actualizar almacenes
						for (Vuelo v : r.getVuelos()) {
							v.getHasta().almacenar(s.getContarBolsas());
						}

					} else {
						noResueltas++;
						System.out.println("FALLÓ: " 
							+ s.getOrigen().getCodigo() + " -> " 
							+ s.getDestino().getCodigo()
							+ " | Motivo: " + (r != null ? r.getMotivoFallo() : "Sin ruta"));
					}
				}

				System.out.println("Total envíos: " + solicitudes.size());
				System.out.println("Resueltas: " + resueltas);
				System.out.println("No resueltas: " + noResueltas);

				if (resueltas > 0) {
					System.out.println("Tiempo promedio: " + (tiempoTotal / resueltas));
				}
			}

			// ===============================
			// SIMULACIÓN AL COLAPSO
			// ===============================
			System.out.println("\n=== SIMULACIÓN AL COLAPSO ===");

			List<Aeropuerto> aeropuertos = new ArrayList<>(aeropuertoPorCodigo.values());
			Random rand = new Random();

			for (int carga = 5; carga <= 30; carga += 5) {

				int resueltas = 0;

				for (int i = 0; i < carga; i++) {

					Aeropuerto origen = aeropuertos.get(rand.nextInt(aeropuertos.size()));
					Aeropuerto destino = aeropuertos.get(rand.nextInt(aeropuertos.size()));

					if (origen.equals(destino)) continue;

					SolicitudEnvio s = new SolicitudEnvio(origen, destino, 2, 2.0);

					Ruta r = planificador.encontrarMejorRuta(s);

					if (r != null && r.esFactible()) {
						resueltas++;
					}
				}

				System.out.println("Carga: " + carga + " → " + resueltas + "/" + carga);
			}

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
	
	private static List<SolicitudEnvio> cargarEnvios(Path archivo, Map<String, Aeropuerto> mapa, String codigoOrigen) throws IOException {
		List<SolicitudEnvio> lista = new ArrayList<>();
		
		Aeropuerto origen = mapa.get(codigoOrigen);
		
		if (origen == null) {
			System.out.println("❌ ERROR: origen no encontrado: " + codigoOrigen);
			return lista;
		}
		
		List<String> lineas = Files.readAllLines(archivo);
		
		System.out.println("Archivo: " + archivo.getFileName());
		System.out.println("Origen usado: " + codigoOrigen);
		
		
		int contador=0;

		for (String l : lineas) {
			
			if (contador >= 100) break;
			
			if (l.trim().isEmpty()) continue;
			
			String[] p = l.split("-");

			if (p.length < 7) continue;

			String codigoDestino = p[4].trim();;
			int cantidad = Integer.parseInt(p[5]);

			Aeropuerto destino = mapa.get(codigoDestino);

			if (destino == null) continue;

			if (!origen.equals(destino)) {
				lista.add(new SolicitudEnvio(origen, destino, cantidad, 2.0));
			}
			contador++;
		}
		
		System.out.println("Solicitudes creadas: " + lista.size());

		return lista;
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