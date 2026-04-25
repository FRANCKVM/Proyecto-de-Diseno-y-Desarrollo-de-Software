import java.util.ArrayList;
import java.util.List;

public class Ruta {
    private final List<Vuelo> vuelos;
    private double tiempoTotal;
    private double costo;
    private boolean factible;
	private String motivoFallo = "";

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
		this.motivoFallo=otro.motivoFallo;
    }

    public void agregarVuelo(Vuelo vuelo) {
        vuelos.add(vuelo);
        tiempoTotal += vuelo.getTiempoViajarDias();
		//tiempo en almacén (10 min es aprox 0.007 dias)
		tiempoTotal += 0.007;
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
		if (vuelos.isEmpty()) {
			this.factible = false;
			this.costo = Double.MAX_VALUE;
			this.motivoFallo = "No se encontró ruta";
			return;
		}
		boolean valido = !vuelos.isEmpty();

		Aeropuerto actual = solicitud.getOrigen();
		double penalizacion = 0;

		for (Vuelo v : vuelos) {
			
			// Secuencia incorrecta
			if (!v.getDesde().equals(actual)) {
				penalizacion += 5000;
				valido = false;
			}

			// Capacidad del vuelo
			if (!v.tieneCapacidad(solicitud.getContarBolsas())) {
				penalizacion += 10000;
				valido = false;
				if (this.motivoFallo.isEmpty()){
					this.motivoFallo = "Sin capacidad en vuelo";
				}
			}

			Aeropuerto siguiente = v.getHasta();

			// VALIDACIÓN DE ALMACÉN
			if (!siguiente.tieneEspacio(solicitud.getContarBolsas())) {
				penalizacion += 8000; // penalización fuerte
				valido = false;
				if (this.motivoFallo.isEmpty()){
					this.motivoFallo = "Almacén lleno";
				}
			}

			actual = siguiente;
		}

		// No llega al destino
		if (!actual.equals(solicitud.getDestino())) {
			penalizacion += 7000;
			valido = false;
			if (this.motivoFallo.isEmpty()){
				this.motivoFallo = "No llega al destino";
			}
		}

		// Exceso de tiempo (penalización proporcional)
		if (tiempoTotal > solicitud.getDiasTiempoMaximo()) {
			penalizacion += (tiempoTotal - solicitud.getDiasTiempoMaximo()) * 1000;
			valido = false;
			if (this.motivoFallo.isEmpty()){
				this.motivoFallo = "Excede tiempo máximo";
			}
		}
		
		if (vuelos.isEmpty()) {
			motivoFallo = "Sin rutas disponibles";
		}

		this.factible = valido;

		if (valido) {
			costo = tiempoTotal;
		} else {
			costo = tiempoTotal + penalizacion;
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
        sb.append("Factible: ").append(factible).append("\n");
        sb.append("Costo: ").append(costo).append("\n");
        return sb.toString();
    }
	
	public String getMotivoFallo() {
		return motivoFallo;
	}
}
