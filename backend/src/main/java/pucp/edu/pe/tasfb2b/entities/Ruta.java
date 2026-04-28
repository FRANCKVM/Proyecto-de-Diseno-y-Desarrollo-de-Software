package pucp.edu.pe.tasfb2b.entities;

import java.util.ArrayList;
import java.util.List;

public class Ruta {
    private final List<Vuelo> vuelos;
    private double tiempoTotal;
    private double costo;
    private boolean factible;

    public Ruta() {
        this.vuelos = new ArrayList<>();
        this.tiempoTotal = 0.0;
        this.costo = Double.MAX_VALUE;
        this.factible = false;
    }

    public Ruta(Ruta otro) {
        this.vuelos = new ArrayList<>(otro.vuelos);
        this.tiempoTotal = otro.tiempoTotal;
        this.costo = otro.costo;
        this.factible = otro.factible;
    }

    public void agregarVuelo(Vuelo vuelo) {
        vuelos.add(vuelo);
        tiempoTotal += vuelo.getTiempoViajarDias();
    }

    public void agregarVuelo(Vuelo vuelo, double incrementoDias) {
        vuelos.add(vuelo);
        tiempoTotal += incrementoDias;
    }

    public List<Vuelo> getVuelos() {
        return vuelos;
    }

    public double getTiempoTotal() {
        return tiempoTotal;
    }

    public double getCosto() {
        return costo;
    }

    public boolean esFactible() {
        return factible;
    }

    public void evaluar(SolicitudEnvio solicitud) {
        boolean valido = !vuelos.isEmpty();

        Aeropuerto actual = solicitud.getOrigen();
        double penalizacion = 0;

        for (Vuelo v : vuelos) {
            // Secuencia incorrecta
            if (!v.getDesde().equals(actual)) {
                penalizacion += 5000;
                valido = false;
            }

            // Capacidad insuficiente
            if (!v.tieneCapacidad(solicitud.getContarBolsas())) {
                penalizacion += 10000;
                valido = false;
            }

            actual = v.getHasta();
        }

        // No llega al destino
        if (!actual.equals(solicitud.getDestino())) {
            penalizacion += 7000;
            valido = false;
        }

        // Exceso de tiempo
        if (tiempoTotal > solicitud.getDiasTiempoMaximo()) {
            penalizacion += (tiempoTotal - solicitud.getDiasTiempoMaximo()) * 1000;
            valido = false;
        }

        /*
         * Penalización logística por cantidad de vuelos.
         * No modifica el tiempo real, solo el costo que optimiza el algoritmo.
         * Esto favorece rutas con menos escalas.
         */
        double penalizacionSaltos = vuelos.size() * 0.03;

        this.factible = valido;

        if (valido) {
            costo = tiempoTotal + penalizacionSaltos;
        } else {
            costo = tiempoTotal + penalizacionSaltos + penalizacion;
        }
    }

    public void reservarCapacidad(int bolsas) {
        for (Vuelo v : vuelos) {
            v.reservar(bolsas);
        }
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();

        for (Vuelo v : vuelos) {
            sb.append(v.getDesde().getCodigo())
              .append(" -> ")
              .append(v.getHasta().getCodigo())
              .append("\n");
        }

        sb.append("Tiempo total: ").append(tiempoTotal).append(" días\n");
        sb.append("Cantidad de vuelos: ").append(vuelos.size()).append("\n");
        sb.append("Factible: ").append(factible).append("\n");
        sb.append("Costo: ").append(costo).append("\n");

        return sb.toString();
    }
}