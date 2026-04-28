package pucp.edu.pe.tasfb2b.algorithms.aco;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;

public class Hormiga {
    private final Grafo grafo;
    private final SolicitudEnvio solicitud;
    private final double[][] feromonas;
    private final List<Aeropuerto> indiceAeropuertos;
    private final double alfa;
    private final double beta;
    private final Random random;

    public Hormiga(Grafo grafo,
                   SolicitudEnvio solicitud,
                   double[][] feromonas,
                   List<Aeropuerto> indiceAeropuertos,
                   double alfa,
                   double beta) {
        this.grafo = grafo;
        this.solicitud = solicitud;
        this.feromonas = feromonas;
        this.indiceAeropuertos = indiceAeropuertos;
        this.alfa = alfa;
        this.beta = beta;
        this.random = new Random();
    }

    public Ruta construirRuta(int saltosMaximos) {
        Ruta ruta = new Ruta();
        Aeropuerto actual = solicitud.getOrigen();
        Set<Aeropuerto> visitados = new HashSet<>();
        visitados.add(actual);

        int saltos = 0;

        // -1 significa que aún no se tomó ningún vuelo.
        // Así no se cuenta espera antes del primer vuelo.
        int tiempoActualUtcMin = -1;

        while (!actual.equals(solicitud.getDestino()) && saltos < saltosMaximos) {
            final int tiempoActual = tiempoActualUtcMin;

            List<Vuelo> candidatos = grafo.getVuelosSalientes(actual).stream()
                .filter(v -> !v.estaCancelado())
                .filter(v -> v.tieneCapacidad(solicitud.getContarBolsas()))
                .filter(v -> !visitados.contains(v.getHasta()))
                .filter(v -> {
                    double incrementoDias = calcularIncrementoDias(v, tiempoActual);
                    return ruta.getTiempoTotal() + incrementoDias <= solicitud.getDiasTiempoMaximo();
                })
                .toList();

            if (candidatos.isEmpty()) {
                break;
            }

            Vuelo seleccionado = seleccionarSiguienteVuelo(actual, candidatos, tiempoActualUtcMin);

            if (seleccionado == null) {
                break;
            }

            double incrementoDias = calcularIncrementoDias(seleccionado, tiempoActualUtcMin);
            ruta.agregarVuelo(seleccionado, incrementoDias);

            tiempoActualUtcMin = calcularLlegadaAjustada(seleccionado, tiempoActualUtcMin);
            actual = seleccionado.getHasta();
            visitados.add(actual);
            saltos++;
        }

        ruta.evaluar(solicitud);
        return ruta;
    }

    private Vuelo seleccionarSiguienteVuelo(Aeropuerto actual, List<Vuelo> candidatos, int tiempoActualUtcMin) {
        int i = indiceAeropuertos.indexOf(actual);

        double[] probabilidades = new double[candidatos.size()];
        double suma = 0.0;

        for (int k = 0; k < candidatos.size(); k++) {
            Vuelo v = candidatos.get(k);
            int j = indiceAeropuertos.indexOf(v.getHasta());

            if (i < 0 || j < 0) {
                continue;
            }

            double costoMovimientoDias = calcularIncrementoDias(v, tiempoActualUtcMin);

            if (costoMovimientoDias <= 0) {
                continue;
            }

            double factorDestino = calcularFactorDestino(v);
            double costoHeuristico = costoMovimientoDias * factorDestino;

            if (costoHeuristico <= 0) {
                continue;
            }

            double tau = Math.pow(feromonas[i][j], alfa);
            double eta = Math.pow(1.0 / costoHeuristico, beta);

            probabilidades[k] = tau * eta;
            suma += probabilidades[k];
        }

        if (suma == 0.0) {
            return candidatos.get(random.nextInt(candidatos.size()));
        }

        double r = random.nextDouble() * suma;
        double acumulada = 0.0;

        for (int k = 0; k < candidatos.size(); k++) {
            acumulada += probabilidades[k];

            if (r <= acumulada) {
                return candidatos.get(k);
            }
        }

        return candidatos.get(candidatos.size() - 1);
    }

    private double calcularFactorDestino(Vuelo vuelo) {
        Aeropuerto actual = vuelo.getDesde();
        Aeropuerto siguiente = vuelo.getHasta();
        Aeropuerto destino = solicitud.getDestino();

        String regionActual = actual.getRegion();
        String regionSiguiente = siguiente.getRegion();
        String regionDestino = destino.getRegion();

        // Mejor caso: el vuelo llega directamente al destino.
        if (siguiente.equals(destino)) {
            return 0.10;
        }

        // Si falta información de regiones, no se penaliza.
        if (regionActual == null || regionSiguiente == null || regionDestino == null ||
            regionActual.equals("N/A") || regionSiguiente.equals("N/A") || regionDestino.equals("N/A")) {
            return 1.0;
        }

        // Si ya estoy en la región del destino,
        // quedarme en esa región es aceptable, pero no tan bueno como llegar directo.
        if (regionActual.equals(regionDestino)) {
            if (regionSiguiente.equals(regionDestino)) {
                return 0.80;
            } else {
                return 3.0;
            }
        }

        // Si todavía NO estoy en la región del destino,
        // ir hacia la región destino debe ser muy premiado.
        if (regionSiguiente.equals(regionDestino)) {
            return 0.30;
        }

        // Si sigo en la misma región actual y el destino está en otra región,
        // estoy dando vueltas antes de salir.
        if (regionSiguiente.equals(regionActual)) {
            return 3.0;
        }

        // Si voy a una tercera región que tampoco es la destino,
        // puede servir como escala, pero no es ideal.
        return 2.0;
    }

    private double calcularIncrementoDias(Vuelo vuelo, int tiempoActualUtcMin) {
        int salida = vuelo.getSalidaUtcMin();
        int llegada = vuelo.getLlegadaUtcMin();

        // Asegura que la llegada sea posterior a la salida.
        while (llegada <= salida) {
            llegada += 1440;
        }

        // Primer vuelo: solo cuenta duración del vuelo, no espera previa.
        if (tiempoActualUtcMin == -1) {
            return (llegada - salida) / 1440.0;
        }

        // Si el vuelo ya salió respecto al tiempo actual,
        // se toma el mismo vuelo del día siguiente.
        while (salida < tiempoActualUtcMin) {
            salida += 1440;
            llegada += 1440;
        }

        // Seguridad extra por si al mover la salida quedó inconsistente.
        while (llegada <= salida) {
            llegada += 1440;
        }

        return (llegada - tiempoActualUtcMin) / 1440.0;
    }

    private int calcularLlegadaAjustada(Vuelo vuelo, int tiempoActualUtcMin) {
        int salida = vuelo.getSalidaUtcMin();
        int llegada = vuelo.getLlegadaUtcMin();

        // Asegura que la llegada sea posterior a la salida.
        while (llegada <= salida) {
            llegada += 1440;
        }

        if (tiempoActualUtcMin == -1) {
            return llegada;
        }

        // Si el vuelo ya salió respecto al tiempo actual,
        // se toma el mismo vuelo del día siguiente.
        while (salida < tiempoActualUtcMin) {
            salida += 1440;
            llegada += 1440;
        }

        // Seguridad extra.
        while (llegada <= salida) {
            llegada += 1440;
        }

        return llegada;
    }
}