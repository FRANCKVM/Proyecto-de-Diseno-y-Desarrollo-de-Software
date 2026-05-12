package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import org.springframework.core.io.ClassPathResource;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Service
public class SimulacionCargaService {

    private static final String CARPETA_ENVIOS = "data/_envios_preliminar_";

    private final AeropuertoRepository aeropuertoRepository;

    public SimulacionCargaService(AeropuertoRepository aeropuertoRepository) {
        this.aeropuertoRepository = aeropuertoRepository;
    }

    public synchronized List<SolicitudEnvio> cargarSolicitudes(
            LocalDateTime fechaHoraInicio,
            Integer duracionDias
    ) throws IOException {
        Path carpeta = new ClassPathResource(CARPETA_ENVIOS).getFile().toPath();
        Map<String, Aeropuerto> aeropuertosPorCodigo = cargarAeropuertosPorCodigo();
        List<SolicitudEnvio> solicitudes = cargarSolicitudesDesdeCarpeta(
                carpeta,
                aeropuertosPorCodigo,
                fechaHoraInicio,
                duracionDias
        );
        solicitudes.sort(
                Comparator.comparing(SolicitudEnvio::getFecha)
                        .thenComparing(SolicitudEnvio::getHora)
        );
        return solicitudes;
    }

    private List<SolicitudEnvio> cargarSolicitudesDesdeCarpeta(
            Path carpetaEnvios,
            Map<String, Aeropuerto> aeropuertosPorCodigo,
            LocalDateTime fechaHoraInicio,
            Integer duracionDias
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
            todasLasSolicitudes.addAll(cargarSolicitudesDesdeArchivo(
                    archivo,
                    aeropuertosPorCodigo,
                    fechaHoraInicio,
                    duracionDias
            ));
        }

        return todasLasSolicitudes;
    }

    private List<SolicitudEnvio> cargarSolicitudesDesdeArchivo(
            Path archivoEnvios,
            Map<String, Aeropuerto> aeropuertosPorCodigo,
            LocalDateTime fechaHoraInicio,
            Integer duracionDias
    ) throws IOException {

        List<SolicitudEnvio> solicitudes = new ArrayList<>();
        LocalDateTime fechaHoraFin = duracionDias != null
                ? fechaHoraInicio.plusDays(duracionDias)
                : null;

        String nombreArchivo = archivoEnvios.getFileName().toString();
        String[] partesNombre = nombreArchivo.split("_");

        if (partesNombre.length < 3) {
            throw new IllegalArgumentException(
                    "No se pudo obtener el aeropuerto origen desde el archivo: " + nombreArchivo
            );
        }

        String codigoOrigen = partesNombre[2];
        Aeropuerto origen = aeropuertosPorCodigo.get(codigoOrigen);

        if (origen == null) {
            throw new IllegalArgumentException("No existe aeropuerto origen en la BD: " + codigoOrigen);
        }

        try (var lineas = Files.lines(archivoEnvios, StandardCharsets.UTF_8)) {
            Iterator<String> iterador = lineas.iterator();

            while (iterador.hasNext()) {
                String linea = iterador.next().trim();

                if (linea.isEmpty()) {
                    continue;
                }

                String[] partes = linea.split("-");

                if (partes.length < 7) {
                    continue;
                }

                LocalDate fechaSolicitud = extraerFechaSolicitud(partes);
                LocalTime horaSolicitud = extraerHoraSolicitud(partes);
                LocalDateTime fechaHoraSolicitud = LocalDateTime.of(
                        fechaSolicitud,
                        horaSolicitud
                );

                if (fechaHoraSolicitud.isBefore(fechaHoraInicio)) {
                    continue;
                }

                if (fechaHoraFin != null && !fechaHoraSolicitud.isBefore(fechaHoraFin)) {
                    break;
                }

                String codigoDestino = partes[4].trim();
                int cantidadMaletas = Integer.parseInt(partes[5].trim());

                Aeropuerto destino = aeropuertosPorCodigo.get(codigoDestino);

                if (destino == null || origen.equals(destino)) {
                    continue;
                }

                double plazoMaximoDias = calcularPlazoMaximoDias(origen, destino);

                solicitudes.add(new SolicitudEnvio(
                        null,
                        fechaSolicitud,
                        horaSolicitud,
                        1,
                        origen,
                        destino,
                        cantidadMaletas,
                        plazoMaximoDias
                ));
            }
        }

        return solicitudes;
    }

    private Map<String, Aeropuerto> cargarAeropuertosPorCodigo() {
        Map<String, Aeropuerto> aeropuertosPorCodigo = new HashMap<>();

        for (Aeropuerto aeropuerto : aeropuertoRepository.findAll()) {
            aeropuertosPorCodigo.put(aeropuerto.getCodigo(), aeropuerto);
        }

        return aeropuertosPorCodigo;
    }

    private LocalTime extraerHoraSolicitud(String[] partes) {
        for (int i = 0; i < partes.length - 1; i++) {
            String hora = partes[i].trim();
            String minuto = partes[i + 1].trim();

            if (hora.matches("\\d{2}") && minuto.matches("\\d{2}")) {
                int horaInt = Integer.parseInt(hora);
                int minutoInt = Integer.parseInt(minuto);

                if (horaInt >= 0 && horaInt < 24 && minutoInt >= 0 && minutoInt < 60) {
                    return LocalTime.of(horaInt, minutoInt);
                }
            }
        }

        for (String parte : partes) {
            String valor = parte.trim();

            if (valor.matches("\\d{2}:\\d{2}")) {
                return LocalTime.parse(valor);
            }
        }

        return LocalTime.of(0, 0);
    }

    private LocalDate extraerFechaSolicitud(String[] partes) {
        for (String parte : partes) {
            String valor = parte.trim();

            if (valor.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return LocalDate.parse(valor);
            }

            if (valor.matches("\\d{8}")) {
                int anio = Integer.parseInt(valor.substring(0, 4));
                int mes = Integer.parseInt(valor.substring(4, 6));
                int dia = Integer.parseInt(valor.substring(6, 8));

                return LocalDate.of(anio, mes, dia);
            }
        }

        return LocalDate.now();
    }

    private double calcularPlazoMaximoDias(Aeropuerto origen, Aeropuerto destino) {
        if (origen.getRegion().equals(destino.getRegion())) {
            return 1.0;
        }

        return 2.0;
    }
}
