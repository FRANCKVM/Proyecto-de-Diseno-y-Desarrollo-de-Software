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

    public void addFlight(Vuelo vuelo) {
        vuelos.add(vuelo);
        tiempoTotal += vuelo.getTiempoViajarDias();
		// tiempo en almacén (10 min que es aprox 0.007 dias)
		tiempoTotal += 0.007;
    }

    public List<Vuelo> getFlights() {
        return vuelos;
    }

    public double getTotalTime() {
        return tiempoTotal;
    }

    public double getCost() {
        return costo;
    }

    public boolean isFeasible() {
        return factible;
    }

    public void evaluate(SolicitudEnvio solicitud) {
        boolean valido = !vuelos.isEmpty();

        Aeropuerto actual = solicitud.getOrigin();
        for (Vuelo v : vuelos) {
            if (!v.getDesde().equals(actual)) {
                valido = false;
                break;
            }
            if (!v.tieneCapacidad(solicitud.getBagCount())) {
                valido = false;
                break;
            }
            actual = v.getHasta();
        }

        if (!actual.equals(solicitud.getDestination())) {
            valido = false;
        }

        if (tiempoTotal > solicitud.getMaxTimeDays()) {
            valido = false;
        }

        this.factible = valido;

        if (valido) {
            costo = tiempoTotal;
        } else {
            costo = 1000000 + tiempoTotal;
        }
    }

    public void reserveCapacity(int bolsas) {
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
        sb.append("Factible: ").append(factible).append("\n");
        sb.append("Costo: ").append(costo).append("\n");
        return sb.toString();
    }
}
