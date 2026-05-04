package pucp.edu.pe.tasfb2b.services;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pucp.edu.pe.tasfb2b.algorithms.ga.PlanificadorGenetico;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

@Service
public class SimulacionService {

    private final GrafoService grafoService;
    private final AeropuertoRepository aeropuertoRepository;

    public SimulacionService(
            GrafoService grafoService,
            AeropuertoRepository aeropuertoRepository
    ) {
        this.grafoService = grafoService;
        this.aeropuertoRepository = aeropuertoRepository;
    }

    @Transactional(readOnly = true)
    public ResultadoSimulacion simularPeriodo(
            String carpetaEnvios,
            int limitePorArchivo,
            int tamanoPoblacion,
            int generaciones,
            double tasaCruzamiento,
            double tasaMutacion,
            int tamanoTorneo,
            int escalasIntermediasMax
    ) throws IOException {

        Map<String, Aeropuerto> aeropuertoPorCodigo = cargarAeropuertosDesdeBD();

        Path carpeta = new ClassPathResource(carpetaEnvios).getFile().toPath();

        List<SolicitudEnvio> solicitudes = cargarSolicitudesDesdeCarpeta(
                carpeta,
                aeropuertoPorCodigo,
                limitePorArchivo
        );

        Grafo grafo = grafoService.construirGrafo();

        PlanificadorGenetico planificadorGA = new PlanificadorGenetico(
                grafo,
                tamanoPoblacion,
                generaciones,
                tasaCruzamiento,
                tasaMutacion,
                tamanoTorneo,
                escalasIntermediasMax
        );

        return procesarSolicitudes(solicitudes, planificadorGA);
    }

    @Transactional(readOnly = true)
    public ResultadoSimulacion simularPeriodoPorDefecto() throws IOException {
        return simularPeriodo(
                "data/_envios_preliminar_",
                50,
                30,
                60,
                0.85,
                0.25,
                3,
                4
        );
    }

    private ResultadoSimulacion procesarSolicitudes(
            List<SolicitudEnvio> solicitudes,
            PlanificadorGenetico planificadorGA
    ) {
        int resueltas = 0;
        int noResueltas = 0;

        int noResueltasPorAlmacenOrigen = 0;
        int noResueltasPorRutaVueloPlazo = 0;

        int rutasDirectas = 0;
        int rutasConParada = 0;

        int totalVuelosUsados = 0;
        int totalEscalas = 0;

        double costoTotalRutas = 0.0;
        long tiempoPlanificacionTotalNs = 0;

        for (int i = 0; i < solicitudes.size(); i++) {
            SolicitudEnvio solicitud = solicitudes.get(i);
            Aeropuerto origen = solicitud.getOrigen();

            if (!origen.tieneCapacidad(solicitud.getContarBolsas())) {
                noResueltas++;
                noResueltasPorAlmacenOrigen++;
                continue;
            }

            long inicioPlanificacion = System.nanoTime();

            Ruta mejorRuta = planificadorGA.encontrarMejorRuta(solicitud);

            long finPlanificacion = System.nanoTime();

            tiempoPlanificacionTotalNs += (finPlanificacion - inicioPlanificacion);

            if (mejorRuta != null && mejorRuta.esFactible()) {
                costoTotalRutas += mejorRuta.getCosto();

                origen.descontarCapacidad(solicitud.getContarBolsas());
                mejorRuta.reservarCapacidad(solicitud.getContarBolsas());

                resueltas++;

                int cantidadVuelos = mejorRuta.getVuelos().size();
                int cantidadEscalas = Math.max(0, cantidadVuelos - 1);

                totalVuelosUsados += cantidadVuelos;
                totalEscalas += cantidadEscalas;

                if (cantidadVuelos == 1) {
                    rutasDirectas++;
                } else {
                    rutasConParada++;
                }

            } else {
                noResueltas++;
                noResueltasPorRutaVueloPlazo++;
            }
        }

        int totalSolicitudes = solicitudes.size();

        double tiempoPlanificacionTotalSeg = tiempoPlanificacionTotalNs / 1_000_000_000.0;

        double tiempoPromedioPorSolicitudMs = totalSolicitudes == 0
                ? 0.0
                : tiempoPlanificacionTotalNs / 1_000_000.0 / totalSolicitudes;

        double porcentajeResueltas = totalSolicitudes == 0
                ? 0.0
                : ((double) resueltas / totalSolicitudes) * 100.0;

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

        return new ResultadoSimulacion(
                totalSolicitudes,
                resueltas,
                noResueltas,
                noResueltasPorAlmacenOrigen,
                noResueltasPorRutaVueloPlazo,
                rutasDirectas,
                rutasConParada,
                totalVuelosUsados,
                totalEscalas,
                promedioVuelos,
                promedioEscalas,
                porcentajeDirectas,
                porcentajeConParada,
                costoPromedioRutas,
                porcentajeResueltas,
                tiempoPlanificacionTotalSeg,
                tiempoPromedioPorSolicitudMs,
                fitnessGlobal
        );
    }

    private Map<String, Aeropuerto> cargarAeropuertosDesdeBD() {
        Map<String, Aeropuerto> aeropuertoPorCodigo = new HashMap<>();

        for (Aeropuerto aeropuerto : aeropuertoRepository.findAll()) {
            aeropuertoPorCodigo.put(aeropuerto.getCodigo(), aeropuerto);
        }

        return aeropuertoPorCodigo;
    }

    private List<SolicitudEnvio> cargarSolicitudesDesdeCarpeta(
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
        }

        return todasLasSolicitudes;
    }

    private List<SolicitudEnvio> cargarSolicitudesDesdeArchivo(
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
            throw new IllegalArgumentException("No existe aeropuerto origen en la BD: " + codigoOrigen);
        }

        try (var lineas = Files.lines(archivoEnvios, StandardCharsets.UTF_8)) {
            Iterator<String> iterador = lineas.iterator();

            while (iterador.hasNext() && solicitudes.size() < limite) {
                String linea = iterador.next().trim();

                if (linea.isEmpty()) {
                    continue;
                }

                String[] partes = linea.split("-");

                if (partes.length < 7) {
                    continue;
                }

                String codigoDestino = partes[4].trim();
                int cantidadMaletas = Integer.parseInt(partes[5].trim());

                Aeropuerto destino = aeropuertoPorCodigo.get(codigoDestino);

                if (destino == null) {
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

    private double calcularPlazoMaximoDias(Aeropuerto origen, Aeropuerto destino) {
        if (origen.getRegion().equals(destino.getRegion())) {
            return 1.0;
        }

        return 2.0;
    }

    public static class ResultadoSimulacion {

        private final int totalSolicitudes;
        private final int resueltas;
        private final int noResueltas;
        private final int noResueltasPorAlmacenOrigen;
        private final int noResueltasPorRutaVueloPlazo;

        private final int rutasDirectas;
        private final int rutasConParada;
        private final int totalVuelosUsados;
        private final int totalEscalas;

        private final double promedioVuelos;
        private final double promedioEscalas;
        private final double porcentajeDirectas;
        private final double porcentajeConParada;

        private final double costoPromedioRutas;
        private final double porcentajeResueltas;
        private final double tiempoPlanificacionTotalSeg;
        private final double tiempoPromedioPorSolicitudMs;
        private final double fitnessGlobal;

        public ResultadoSimulacion(
                int totalSolicitudes,
                int resueltas,
                int noResueltas,
                int noResueltasPorAlmacenOrigen,
                int noResueltasPorRutaVueloPlazo,
                int rutasDirectas,
                int rutasConParada,
                int totalVuelosUsados,
                int totalEscalas,
                double promedioVuelos,
                double promedioEscalas,
                double porcentajeDirectas,
                double porcentajeConParada,
                double costoPromedioRutas,
                double porcentajeResueltas,
                double tiempoPlanificacionTotalSeg,
                double tiempoPromedioPorSolicitudMs,
                double fitnessGlobal
        ) {
            this.totalSolicitudes = totalSolicitudes;
            this.resueltas = resueltas;
            this.noResueltas = noResueltas;
            this.noResueltasPorAlmacenOrigen = noResueltasPorAlmacenOrigen;
            this.noResueltasPorRutaVueloPlazo = noResueltasPorRutaVueloPlazo;
            this.rutasDirectas = rutasDirectas;
            this.rutasConParada = rutasConParada;
            this.totalVuelosUsados = totalVuelosUsados;
            this.totalEscalas = totalEscalas;
            this.promedioVuelos = promedioVuelos;
            this.promedioEscalas = promedioEscalas;
            this.porcentajeDirectas = porcentajeDirectas;
            this.porcentajeConParada = porcentajeConParada;
            this.costoPromedioRutas = costoPromedioRutas;
            this.porcentajeResueltas = porcentajeResueltas;
            this.tiempoPlanificacionTotalSeg = tiempoPlanificacionTotalSeg;
            this.tiempoPromedioPorSolicitudMs = tiempoPromedioPorSolicitudMs;
            this.fitnessGlobal = fitnessGlobal;
        }

        public int getTotalSolicitudes() {
            return totalSolicitudes;
        }

        public int getResueltas() {
            return resueltas;
        }

        public int getNoResueltas() {
            return noResueltas;
        }

        public int getNoResueltasPorAlmacenOrigen() {
            return noResueltasPorAlmacenOrigen;
        }

        public int getNoResueltasPorRutaVueloPlazo() {
            return noResueltasPorRutaVueloPlazo;
        }

        public int getRutasDirectas() {
            return rutasDirectas;
        }

        public int getRutasConParada() {
            return rutasConParada;
        }

        public int getTotalVuelosUsados() {
            return totalVuelosUsados;
        }

        public int getTotalEscalas() {
            return totalEscalas;
        }

        public double getPromedioVuelos() {
            return promedioVuelos;
        }

        public double getPromedioEscalas() {
            return promedioEscalas;
        }

        public double getPorcentajeDirectas() {
            return porcentajeDirectas;
        }

        public double getPorcentajeConParada() {
            return porcentajeConParada;
        }

        public double getCostoPromedioRutas() {
            return costoPromedioRutas;
        }

        public double getPorcentajeResueltas() {
            return porcentajeResueltas;
        }

        public double getTiempoPlanificacionTotalSeg() {
            return tiempoPlanificacionTotalSeg;
        }

        public double getTiempoPromedioPorSolicitudMs() {
            return tiempoPromedioPorSolicitudMs;
        }

        public double getFitnessGlobal() {
            return fitnessGlobal;
        }
    }
}