package pucp.edu.pe.tasfb2b.seed;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final AeropuertoRepository aeropuertoRepository;
    private final VueloRepository vueloRepository;

    public DatabaseSeeder(
            AeropuertoRepository aeropuertoRepository,
            VueloRepository vueloRepository
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.vueloRepository = vueloRepository;
    }

    @Override
    public void run(String... args) throws Exception {

        if (aeropuertoRepository.count() > 0 || vueloRepository.count() > 0) {
            System.out.println("La base de datos ya tiene datos. No se ejecuta el seeder.");
            return;
        }

        System.out.println("Iniciando carga inicial de aeropuertos y vuelos...");

        Map<String, Aeropuerto> aeropuertos = cargarAeropuertos(
                "data/c.1inf54.26.1.v1.Aeropuerto.husos.v1.20250818__estudiantes.txt"
        );

        cargarVuelos("data/planes_vuelo.txt", aeropuertos);

        System.out.println("Carga inicial finalizada.");
        System.out.println("Aeropuertos guardados: " + aeropuertoRepository.count());
        System.out.println("Vuelos guardados: " + vueloRepository.count());
    }

    private Map<String, Aeropuerto> cargarAeropuertos(String rutaArchivo) throws IOException {

        Map<String, Aeropuerto> aeropuertoPorCodigo = new HashMap<>();

        List<String> lineas;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(rutaArchivo).getInputStream(), StandardCharsets.UTF_16))) {
            lineas = reader.lines().toList();
        }

        String regionActual = "N/A";

        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                "^\\d{2}\\s+" +                    // número
                "(\\S+)\\s+" +                     // código
                "(.+?)\\s{2,}" +                   // ciudad
                "(.+?)\\s{2,}" +                   // país
                "(\\S+)\\s+" +                     // alias
                "([+-]?\\d+)\\s+" +                // GMT
                "(\\d+)\\s+" +                     // capacidad
                "Latitude:\\s*" +
                "(\\d+)°\\s*(\\d+)'\\s*(\\d+)[\"']\\s*([NS])\\s+" +
                "Longitude:\\s*" +
                "(\\d+)°\\s*(\\d+)'\\s*(\\d+)[\"']\\s*([EW]).*"
        );

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

            java.util.regex.Matcher matcher = pattern.matcher(ajustada);

            if (!matcher.matches()) {
                System.out.println("No se pudo leer aeropuerto: " + ajustada);
                continue;
            }

            String codigo = matcher.group(1).trim();
            String ciudad = matcher.group(2).trim();
            String pais = matcher.group(3).trim();
            String alias = matcher.group(4).trim();

            int desplazamientoGMT = parseIntSinSigno(matcher.group(5), 0);
            int capacidad = parseIntSinSigno(matcher.group(6), 0);

            double latitud = convertirCoordenadaDecimal(
                    matcher.group(7),
                    matcher.group(8),
                    matcher.group(9),
                    matcher.group(10)
            );

            double longitud = convertirCoordenadaDecimal(
                    matcher.group(11),
                    matcher.group(12),
                    matcher.group(13),
                    matcher.group(14)
            );

            Aeropuerto aeropuerto = new Aeropuerto(
                    codigo,
                    ciudad,
                    regionActual,
                    pais,
                    alias,
                    desplazamientoGMT,
                    capacidad,
                    latitud,
                    longitud
            );

            Aeropuerto guardado = aeropuertoRepository.save(aeropuerto);

            aeropuertoPorCodigo.put(codigo, guardado);
        }

        return aeropuertoPorCodigo;
    }

    private void cargarVuelos(
            String rutaArchivo,
            Map<String, Aeropuerto> aeropuertoPorCodigo
    ) throws IOException {

        List<String> lineas;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ClassPathResource(rutaArchivo).getInputStream(), StandardCharsets.UTF_8))) {
            lineas = reader.lines().toList();
        }

        int vuelosCargados = 0;
        int vuelosOmitidos = 0;

        for (String linea : lineas) {
            String ajustada = linea.trim();

            if (ajustada.isEmpty()) {
                continue;
            }

            String[] partes = ajustada.split("-");

            if (partes.length < 5) {
                vuelosOmitidos++;
                continue;
            }

            String codigoDesde = partes[0].trim();
            String codigoHasta = partes[1].trim();

            Aeropuerto desde = aeropuertoPorCodigo.get(codigoDesde);
            Aeropuerto hasta = aeropuertoPorCodigo.get(codigoHasta);

            if (desde == null || hasta == null) {
                System.out.println("Vuelo omitido. Aeropuerto no encontrado: " + ajustada);
                vuelosOmitidos++;
                continue;
            }

            int salidaUtcMin = convertirHoraLocalAUtcMin(partes[2].trim(), desde);
            int llegadaUtcMin = convertirHoraLocalAUtcMin(partes[3].trim(), hasta);

            if (llegadaUtcMin <= salidaUtcMin) {
                llegadaUtcMin += 1440;
            }

            double tiempoViajarDias = (llegadaUtcMin - salidaUtcMin) / 1440.0;

            int capacidad = Integer.parseInt(partes[4].trim());

            Vuelo vuelo = new Vuelo(
                    desde,
                    hasta,
                    tiempoViajarDias,
                    capacidad,
                    salidaUtcMin,
                    llegadaUtcMin
            );

            vueloRepository.save(vuelo);

            vuelosCargados++;
        }

        System.out.println("Vuelos cargados: " + vuelosCargados);
        System.out.println("Vuelos omitidos: " + vuelosOmitidos);
    }

    private int convertirHoraLocalAUtcMin(String hora, Aeropuerto aeropuerto) {
        String[] partes = hora.trim().split(":");

        int horaMinutos = Integer.parseInt(partes[0]) * 60 + Integer.parseInt(partes[1]);

        int utcMin = horaMinutos - aeropuerto.getDesplazamientoGMT() * 60;

        return ((utcMin % 1440) + 1440) % 1440;
    }

    private double convertirCoordenadaDecimal(
            String gradosTexto,
            String minutosTexto,
            String segundosTexto,
            String direccion
    ) {
        double grados = Double.parseDouble(gradosTexto);
        double minutos = Double.parseDouble(minutosTexto);
        double segundos = Double.parseDouble(segundosTexto);

        double decimal = grados + (minutos / 60.0) + (segundos / 3600.0);

        if (direccion.equalsIgnoreCase("S") || direccion.equalsIgnoreCase("W")) {
            decimal *= -1;
        }

        return decimal;
    }

    private int parseIntSinSigno(String valor, int predeterminado) {
        try {
            return Integer.parseInt(valor.replace("+", "").trim());
        } catch (NumberFormatException e) {
            return predeterminado;
        }
    }
}