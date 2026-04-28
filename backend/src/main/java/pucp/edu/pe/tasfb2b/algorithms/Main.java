package pucp.edu.pe.tasfb2b.algorithms;

import java.nio.file.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Function;

import pucp.edu.pe.tasfb2b.algorithms.aco.PlanificadorACO;
import pucp.edu.pe.tasfb2b.algorithms.ga.PlanificadorGenetico;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;

public class Main {

    private static final double PROBABILIDAD_CANCELACION = 0.3;
    private static final long SEMILLA_CANCELACION = 42L;

    public static void main(String[] args) {
        try {
            String algoritmo = args.length > 0 ? args[0].toLowerCase() : "aco";

            // ===== RUTA DE DATA =====
            Path dirDatos = Path.of("pucp", "edu", "pe", "tasfb2b", "algorithms", "data");

            // ===== CARGAR AEROPUERTOS =====
            Map<String, Aeropuerto> aeropuertoPorCodigo = cargarAeropuertos(
                dirDatos.resolve("c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt")
            );

            // ===== CARGAR VUELOS CON CANCELACIÓN ALEATORIA =====
            Grafo grafo = cargarVuelos(
                dirDatos.resolve("planes_vuelo.txt"),
                aeropuertoPorCodigo,
                PROBABILIDAD_CANCELACION
            );

            // ===== CARGAR SOLICITUDES =====
            Path carpetaEnvios = dirDatos.resolve("_envios_preliminar_");

            List<SolicitudEnvio> solicitudes = cargarSolicitudesDesdeCarpeta(
                carpetaEnvios,
                aeropuertoPorCodigo,
                50

            );

            System.out.println("Algoritmo seleccionado: " + algoritmo.toUpperCase());
            System.out.println("Probabilidad de cancelación de vuelos: " + (PROBABILIDAD_CANCELACION * 100) + "%");
            System.out.println("Solicitudes cargadas: " + solicitudes.size());

            // ===== SELECCIONAR PLANIFICADOR =====
            Function<SolicitudEnvio, Ruta> planificarRuta;

            if (algoritmo.equals("aco")) {
                PlanificadorACO planificadorACO = new PlanificadorACO(
                    grafo,
                    30,     // hormigas
                    30,     // iteraciones
                    1.0,    // alfa
                    2.0,    // beta
                    0.2,    // evaporación
                    100.0,  // q
                    10      // saltos máximos
                );

                planificarRuta = planificadorACO::encontrarMejorRuta;

            } else if (algoritmo.equals("ga")) {
                PlanificadorGenetico planificadorGA = new PlanificadorGenetico(
                    grafo,
                    30,     // tamaño población
                    60,     // generaciones
                    0.85,   // tasa cruzamiento
                    0.25,   // tasa mutación
                    3,      // tamaño torneo
                    4       // escalas intermedias máximas
                );

                planificarRuta = planificadorGA::encontrarMejorRuta;

            } else {
                throw new IllegalArgumentException("Algoritmo no válido. Usa: aco o ga");
            }

            int resueltas = 0;
            int noResueltas = 0;
            double costoTotalRutas = 0.0;
            int noResueltasPorAlmacenOrigen = 0;
            int noResueltasPorRutaVueloPlazo = 0;

            int rutasDirectas = 0;
            int rutasConParada = 0;
            int totalVuelosUsados = 0;
            int totalEscalas = 0;
            double fitnessTotal = 0.0;
            long tiempoPlanificacionTotalNs = 0;

            // ===== PROCESAR SOLICITUDES =====
            for (int i = 0; i < solicitudes.size(); i++) {

                SolicitudEnvio solicitud = solicitudes.get(i);
                Aeropuerto origen = solicitud.getOrigen();

                System.out.println("\n=== Solicitud " + (i + 1) + " ===");
                System.out.println("Origen: " + solicitud.getOrigen().getCodigo()
                        + " | Destino: " + solicitud.getDestino().getCodigo()
                        + " | Maletas: " + solicitud.getContarBolsas()
                        + " | Plazo: " + solicitud.getDiasTiempoMaximo() + " días");

                // 1. Validar capacidad del almacén origen
                if (!origen.tieneCapacidad(solicitud.getContarBolsas())) {
                    noResueltas++;
                    noResueltasPorAlmacenOrigen++;

                    System.out.println("No hay capacidad en almacén origen.");
                    continue;
                }

                // 2. Buscar mejor ruta usando ACO o GA
                long inicioPlanificacion = System.nanoTime();

                Ruta mejorRuta = planificarRuta.apply(solicitud);

                long finPlanificacion = System.nanoTime();

                tiempoPlanificacionTotalNs += (finPlanificacion - inicioPlanificacion);

                // 3. Si hay ruta, reservar recursos
                if (mejorRuta != null && mejorRuta.esFactible()) {
                    costoTotalRutas += mejorRuta.getCosto();
                    origen.descontarCapacidad(solicitud.getContarBolsas());
                    mejorRuta.reservarCapacidad(solicitud.getContarBolsas());

                    resueltas++;
                    fitnessTotal += mejorRuta.getCosto();
                    int cantidadVuelos = mejorRuta.getVuelos().size();
                    int cantidadEscalas = Math.max(0, cantidadVuelos - 1);

                    totalVuelosUsados += cantidadVuelos;
                    totalEscalas += cantidadEscalas;

                    if (cantidadVuelos == 1) {
                        rutasDirectas++;
                    } else {
                        rutasConParada++;
                    }

                    System.out.println("RUTA ENCONTRADA:");
                    System.out.println(mejorRuta);
                    System.out.println("Capacidad restante almacén origen: " + origen.getCapacidad());
                } else {
                    noResueltas++;
                    noResueltasPorRutaVueloPlazo++;

                    System.out.println("No se encontró ruta");
                }
            }

            // ===== RESUMEN =====
            System.out.println("\n=== RESUMEN ===");
            System.out.println("Algoritmo: " + algoritmo.toUpperCase());
            System.out.println("Probabilidad de cancelación de vuelos: " + (PROBABILIDAD_CANCELACION * 100) + "%");
            System.out.println("Total: " + solicitudes.size());
            System.out.println("Resueltas: " + resueltas);
            System.out.println("No resueltas: " + noResueltas);

            System.out.println("No resueltas por almacén origen: " + noResueltasPorAlmacenOrigen);
            System.out.println("No resueltas por ruta/vuelo/plazo: " + noResueltasPorRutaVueloPlazo);

            System.out.println("Rutas directas: " + rutasDirectas);
            System.out.println("Rutas con parada: " + rutasConParada);
            System.out.println("Total de vuelos usados: " + totalVuelosUsados);
            System.out.println("Total de escalas: " + totalEscalas);

            if (resueltas > 0) {
                double tiempoPlanificacionTotalSeg = tiempoPlanificacionTotalNs / 1_000_000_000.0;
double tiempoPromedioPorSolicitudMs = solicitudes.isEmpty()
        ? 0
        : tiempoPlanificacionTotalNs / 1_000_000.0 / solicitudes.size();

double porcentajeResueltas = solicitudes.isEmpty()
        ? 0.0
        : ((double) resueltas / solicitudes.size()) * 100.0;

double costoPromedioRutas = resueltas == 0
        ? 0.0
        : costoTotalRutas / resueltas;

double promedioVuelos = resueltas == 0
        ? 0.0
        : (double) totalVuelosUsados / resueltas;

double promedioEscalas = resueltas == 0
        ? 0.0
        : (double) totalEscalas / resueltas;

double porcentajeDirectas = resueltas == 0
        ? 0.0
        : (double) rutasDirectas * 100.0 / resueltas;

double porcentajeConParada = resueltas == 0
        ? 0.0
        : (double) rutasConParada * 100.0 / resueltas;

double penalizacionEscalas = promedioEscalas * 2.0;
double penalizacionTiempo = tiempoPlanificacionTotalSeg * 0.05;

double fitnessGlobal = porcentajeResueltas - penalizacionEscalas - penalizacionTiempo;
fitnessGlobal = Math.max(0.0, Math.min(100.0, fitnessGlobal));

System.out.println("Promedio de vuelos por ruta: " + promedioVuelos);
System.out.println("Promedio de escalas por ruta: " + promedioEscalas);
System.out.println("Porcentaje de rutas directas: " + porcentajeDirectas + "%");
System.out.println("Porcentaje de rutas con parada: " + porcentajeConParada + "%");

System.out.println("Costo promedio de rutas: " + costoPromedioRutas);
System.out.println("Porcentaje de solicitudes resueltas: " + porcentajeResueltas + "%");
System.out.println("Tiempo total de planificación: " + tiempoPlanificacionTotalSeg + " s");
System.out.println("Tiempo promedio por solicitud: " + tiempoPromedioPorSolicitudMs + " ms");
System.out.println("Fitness global del algoritmo: " + fitnessGlobal + "%");

            }

            double tiempoPlanificacionTotalSeg = tiempoPlanificacionTotalNs / 1_000_000_000.0;
            double tiempoPromedioPorSolicitudMs = solicitudes.isEmpty()
                    ? 0
                    : tiempoPlanificacionTotalNs / 1_000_000.0 / solicitudes.size();

            System.out.println("Tiempo total de planificación: " + tiempoPlanificacionTotalSeg + " s");
            System.out.println("Tiempo promedio por solicitud: " + tiempoPromedioPorSolicitudMs + " ms");

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

        String regionActual = "N/A";

        for (String linea : lineas) {
            String ajustada = linea.trim();

            if (ajustada.isEmpty()) {
                continue;
            }

            if (ajustada.contains("America del Sur")) {
                regionActual = "America del Sur";
                continue;
            }

            if (ajustada.equalsIgnoreCase("Europa")) {
                regionActual = "Europa";
                continue;
            }

            if (ajustada.equalsIgnoreCase("Asia")) {
                regionActual = "Asia";
                continue;
            }

            if (!ajustada.matches("^\\d{2}\\s+.*")) {
                continue;
            }

            String[] partes = ajustada.split("\\s+");

            if (partes.length < 7) {
                continue;
            }

            String codigo = partes[1];
            String ciudad = partes[2];

            int indiceGMT = -1;

            for (int i = 2; i < partes.length - 1; i++) {
                if (partes[i].matches("[+-]?\\d+")) {
                    indiceGMT = i;
                    break;
                }
            }

            if (indiceGMT == -1 || indiceGMT + 1 >= partes.length) {
                System.out.println("No se pudo leer GMT/capacidad en línea: " + ajustada);
                continue;
            }

            int desplazamientoGMT = parseIntSinSigno(partes[indiceGMT], 0);
            int capacidad = parseIntSinSigno(partes[indiceGMT + 1], 0);

            aeropuertoPorCodigo.put(
                codigo,
                new Aeropuerto(codigo, ciudad, regionActual, desplazamientoGMT, capacidad)
            );
        }

        return aeropuertoPorCodigo;
    }

    // =========================
    // CARGA DE VUELOS
    // =========================
    private static Grafo cargarVuelos(
            Path archivo,
            Map<String, Aeropuerto> mapa,
            double probabilidadCancelacion
    ) throws IOException {

        Grafo grafo = new Grafo();
        List<String> lineas = Files.readAllLines(archivo);
        Random randomCancelacion = new Random(SEMILLA_CANCELACION);

        int vuelosCargados = 0;
        int vuelosCancelados = 0;

        for (String linea : lineas) {
            String ajustada = linea.trim();

            if (ajustada.isEmpty()) {
                continue;
            }

            String[] p = ajustada.split("-");

            if (p.length < 5) {
                continue;
            }

            Aeropuerto desde = mapa.get(p[0].trim());
            Aeropuerto hasta = mapa.get(p[1].trim());

            if (desde == null || hasta == null) {
                continue;
            }

            int salidaUtcMin = convertirHoraLocalAUtcMin(p[2].trim(), desde);
            int llegadaUtcMin = convertirHoraLocalAUtcMin(p[3].trim(), hasta);

            if (llegadaUtcMin <= salidaUtcMin) {
                llegadaUtcMin += 1440;
            }

            double tiempo = (llegadaUtcMin - salidaUtcMin) / 1440.0;
            int capacidad = Integer.parseInt(p[4].trim());

            Vuelo vuelo = new Vuelo(
                desde,
                hasta,
                tiempo,
                capacidad,
                salidaUtcMin,
                llegadaUtcMin
            );

            vuelosCargados++;

            if (randomCancelacion.nextDouble() < probabilidadCancelacion) {
                vuelo.setCancelado(true);
                vuelosCancelados++;
            }

            grafo.agregarVuelo(vuelo);
        }

        System.out.println("Vuelos cargados: " + vuelosCargados);
        System.out.println("Vuelos cancelados: " + vuelosCancelados);

        return grafo;
    }

    // =========================
    // CARGAR SOLICITUDES DESDE TODA LA CARPETA
    // =========================
    private static List<SolicitudEnvio> cargarSolicitudesDesdeCarpeta(
            Path carpetaEnvios,
            Map<String, Aeropuerto> aeropuertoPorCodigo,
            int limitePorArchivo
    ) throws IOException {

        List<SolicitudEnvio> todasLasSolicitudes = new ArrayList<>();
        List<Path> archivos = new ArrayList<>();

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(carpetaEnvios, "_envios_*_.txt")) {
            for (Path archivo : stream) {
                archivos.add(archivo);
            }
        }

        archivos.sort(Comparator.comparing(path -> path.getFileName().toString()));

        for (Path archivo : archivos) {
            List<SolicitudEnvio> solicitudesArchivo = cargarSolicitudesDesdeArchivo(
                archivo,
                aeropuertoPorCodigo,
                limitePorArchivo
            );

            todasLasSolicitudes.addAll(solicitudesArchivo);

            System.out.println("Archivo " + archivo.getFileName()
                    + " -> solicitudes cargadas: " + solicitudesArchivo.size());
        }

        return todasLasSolicitudes;
    }

    // =========================
    // CARGA DE SOLICITUDES REALES DESDE UN ARCHIVO
    // =========================
    private static List<SolicitudEnvio> cargarSolicitudesDesdeArchivo(
            Path archivoEnvios,
            Map<String, Aeropuerto> aeropuertoPorCodigo,
            int limite
    ) throws IOException {

        List<SolicitudEnvio> solicitudes = new ArrayList<>();

        String nombreArchivo = archivoEnvios.getFileName().toString();

        String[] partesNombre = nombreArchivo.split("_");

        if (partesNombre.length < 3) {
            throw new IllegalArgumentException(
                "No se pudo obtener el aeropuerto origen desde el archivo: " + nombreArchivo
            );
        }

        String codigoOrigen = partesNombre[2];
        Aeropuerto origen = aeropuertoPorCodigo.get(codigoOrigen);

        if (origen == null) {
            throw new IllegalArgumentException("No existe aeropuerto origen en el mapa: " + codigoOrigen);
        }

        try (var lineas = Files.lines(archivoEnvios, StandardCharsets.UTF_8)) {
            Iterator<String> iterador = lineas.iterator();

            while (iterador.hasNext() && solicitudes.size() < limite) {
                String linea = iterador.next().trim();

                if (linea.isEmpty()) {
                    continue;
                }

                String[] p = linea.split("-");

                if (p.length < 7) {
                    continue;
                }

                String codigoDestino = p[4].trim();
                int cantidadMaletas = Integer.parseInt(p[5].trim());

                Aeropuerto destino = aeropuertoPorCodigo.get(codigoDestino);

                if (destino == null) {
                    System.out.println("Destino no encontrado: " + codigoDestino);
                    continue;
                }

                if (origen.equals(destino)) {
                    continue;
                }

                double plazoMaximoDias = calcularPlazoMaximoDias(origen, destino);

                solicitudes.add(new SolicitudEnvio(
                    origen,
                    destino,
                    cantidadMaletas,
                    plazoMaximoDias
                ));
            }
        }

        return solicitudes;
    }

    // =========================
    // PLAZO SEGÚN REGIÓN
    // =========================
    private static double calcularPlazoMaximoDias(Aeropuerto origen, Aeropuerto destino) {
        if (origen.getRegion().equals(destino.getRegion())) {
            return 1.0;
        }

        return 2.0;
    }

    // =========================
    // CONVERTIR HORA LOCAL A MINUTOS UTC
    // =========================
    private static int convertirHoraLocalAUtcMin(String hora, Aeropuerto aeropuerto) {
        String[] partes = hora.trim().split(":");

        int horaMinutos = Integer.parseInt(partes[0]) * 60 + Integer.parseInt(partes[1]);

        int utcMin = horaMinutos - aeropuerto.getDesplazamientoGMT() * 60;

        utcMin = ((utcMin % 1440) + 1440) % 1440;

        return utcMin;
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