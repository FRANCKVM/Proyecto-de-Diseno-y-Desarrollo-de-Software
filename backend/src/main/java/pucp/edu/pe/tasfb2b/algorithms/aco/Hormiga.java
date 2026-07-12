package pucp.edu.pe.tasfb2b.algorithms.aco;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

public class Hormiga {
    private final Grafo grafo;
    private final SolicitudEnvio solicitud;
    private final double[][] feromonas;
    private final List<Aeropuerto> indiceAeropuertos;
    private final double alfa;
    private final double beta;
    private final Random random = new Random();

    public Hormiga(Grafo grafo, SolicitudEnvio solicitud, double[][] feromonas,
                   List<Aeropuerto> indiceAeropuertos, double alfa, double beta) {
        this.grafo = grafo;
        this.solicitud = solicitud;
        this.feromonas = feromonas;
        this.indiceAeropuertos = indiceAeropuertos;
        this.alfa = alfa;
        this.beta = beta;
    }

    public Ruta construirRuta(int saltosMaximos) {
        Ruta ruta = new Ruta();
        Aeropuerto actual = solicitud.getOrigen();
        Set<Aeropuerto> visitados = new HashSet<>();
        visitados.add(actual);
        LocalDateTime cursor = solicitud.getFechaHoraRegistro();

        for (int saltos = 0; !actual.equals(solicitud.getDestino()) && saltos < saltosMaximos; saltos++) {
            Aeropuerto origenActual = actual;
            LocalDateTime cursorActual = cursor;
            List<VueloOcurrencia> candidatos = grafo.getOcurrenciasSalientes(actual).stream()
                    .filter(o -> o.tieneCapacidad(solicitud.getContarBolsas()))
                    .filter(o -> !o.getFechaHoraSalida().isBefore(cursorActual))
                    .filter(o -> !visitados.contains(o.getVuelo().getHasta()))
                    .filter(o -> ruta.getTiempoTotal() + incrementoDias(o, cursorActual)
                            <= solicitud.getDiasTiempoMaximo())
                    .toList();
            if (candidatos.isEmpty()) break;

            VueloOcurrencia seleccionada = seleccionar(origenActual, candidatos, cursorActual);
            if (seleccionada == null) break;
            ruta.agregarOcurrencia(seleccionada, incrementoDias(seleccionada, cursor));
            cursor = seleccionada.getFechaHoraLlegada();
            actual = seleccionada.getVuelo().getHasta();
            visitados.add(actual);
        }

        ruta.evaluar(solicitud);
        return ruta;
    }

    private VueloOcurrencia seleccionar(Aeropuerto actual, List<VueloOcurrencia> candidatos, LocalDateTime cursor) {
        int i = indiceAeropuertos.indexOf(actual);
        double[] probabilidades = new double[candidatos.size()];
        double suma = 0.0;
        for (int k = 0; k < candidatos.size(); k++) {
            VueloOcurrencia ocurrencia = candidatos.get(k);
            Vuelo vuelo = ocurrencia.getVuelo();
            int j = indiceAeropuertos.indexOf(vuelo.getHasta());
            if (i < 0 || j < 0) continue;
            double costo = incrementoDias(ocurrencia, cursor) * factorDestino(vuelo);
            if (costo <= 0) continue;
            probabilidades[k] = Math.pow(feromonas[i][j], alfa) * Math.pow(1.0 / costo, beta);
            suma += probabilidades[k];
        }
        if (suma == 0.0) return candidatos.get(random.nextInt(candidatos.size()));
        double r = random.nextDouble() * suma;
        double acumulada = 0.0;
        for (int k = 0; k < candidatos.size(); k++) {
            acumulada += probabilidades[k];
            if (r <= acumulada) return candidatos.get(k);
        }
        return candidatos.getLast();
    }

    private double factorDestino(Vuelo vuelo) {
        Aeropuerto actual = vuelo.getDesde();
        Aeropuerto siguiente = vuelo.getHasta();
        Aeropuerto destino = solicitud.getDestino();
        if (siguiente.equals(destino)) return 0.10;
        String ra = actual.getRegion(), rs = siguiente.getRegion(), rd = destino.getRegion();
        if (ra == null || rs == null || rd == null || ra.equals("N/A") || rs.equals("N/A") || rd.equals("N/A")) return 1.0;
        if (ra.equals(rd)) return rs.equals(rd) ? 0.80 : 3.0;
        if (rs.equals(rd)) return 0.30;
        if (rs.equals(ra)) return 3.0;
        return 2.0;
    }

    private double incrementoDias(VueloOcurrencia ocurrencia, LocalDateTime cursor) {
        return Duration.between(cursor, ocurrencia.getFechaHoraLlegada()).toMinutes() / 1440.0;
    }
}
