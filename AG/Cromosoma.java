import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Cromosoma {
    private final List<Aeropuerto> genes;
    private double fitness;
    private Ruta ruta;
    private boolean factible;

    public Cromosoma() {
        this.genes = new ArrayList<>();
        this.fitness = Double.MAX_VALUE;
        this.ruta = new Ruta();
        this.factible = false;
    }

    public Cromosoma(List<Aeropuerto> genes) {
        this.genes = new ArrayList<>(genes);
        this.fitness = Double.MAX_VALUE;
        this.ruta = new Ruta();
        this.factible = false;
    }

    public Cromosoma(Cromosoma otro) {
        this.genes = new ArrayList<>(otro.genes);
        this.fitness = otro.fitness;
        this.ruta = new Ruta(otro.ruta);
        this.factible = otro.factible;
    }

    public List<Aeropuerto> getGenes() {
        return genes;
    }

    public double getFitness() {
        return fitness;
    }

    public Ruta getRoute() {
        return ruta;
    }

    public boolean isFeasible() {
        return factible;
    }

    public void setGene(int indice, Aeropuerto aeropuerto) {
        genes.set(indice, aeropuerto);
    }

    public void addGene(Aeropuerto aeropuerto) {
        genes.add(aeropuerto);
    }

    public boolean containsAirport(Aeropuerto aeropuerto) {
        return genes.contains(aeropuerto);
    }

    public void evaluate(Grafo grafo, SolicitudEnvio solicitud) {
		Ruta rutaCandidato = new Ruta();
		boolean valido = true;

		// 🔹 tamaño mínimo
		if (genes.size() < 2) {
			this.fitness = 1_000_000;
			this.factible = false;
			this.ruta = rutaCandidato;
			return;
		}

		// 🔹 origen y destino correctos
		if (!genes.get(0).equals(solicitud.getOrigin()) ||
			!genes.get(genes.size() - 1).equals(solicitud.getDestination())) {

			this.fitness = 1_000_000 + genes.size();

			this.factible = false;
			this.ruta = rutaCandidato;
			return;
		}

		Set<Aeropuerto> visitados = new HashSet<>();

		for (int i = 0; i < genes.size() - 1; i++) {
			Aeropuerto desde = genes.get(i);
			Aeropuerto hasta = genes.get(i + 1);

			// 🔹 evitar ciclos
			if (!visitados.add(desde)) {
				valido = false;
				break;
			}

			Vuelo vuelo = encontrarVuelo(grafo, desde, hasta, solicitud.getBagCount());
			if (vuelo == null) {
				valido = false;
				break;
			}

			// 🔥 validación correcta de tiempo
			if (rutaCandidato.getTotalTime() + vuelo.getTiempoViajarDias() > solicitud.getMaxTimeDays()) {
				valido = false;
				break;
			}

			rutaCandidato.addFlight(vuelo);
		}

		// 🔹 evaluación final
		rutaCandidato.evaluate(solicitud);

		if (!rutaCandidato.isFeasible()) {
			valido = false;
		}

		this.ruta = rutaCandidato;
		this.factible = valido;

		// 🔹 fitness
		if (valido) {
			this.fitness = rutaCandidato.getTotalTime() + 0.05 * genes.size();
		} else {
			this.fitness = 1_000_000 + rutaCandidato.getTotalTime();
		}
	}

    private Vuelo encontrarVuelo(Grafo grafo, Aeropuerto desde, Aeropuerto hasta, int bolsas) {
        for (Vuelo vuelo : grafo.getOutgoingFlights(desde)) {
            if (vuelo.getHasta().equals(hasta) &&
                !vuelo.estaCancelado() &&
                vuelo.tieneCapacidad(bolsas)) {
                return vuelo;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Cromosoma: ");
        for (Aeropuerto aeropuerto : genes) {
            sb.append(aeropuerto.getCodigo()).append(" ");
        }
        sb.append("\nFitness: ").append(fitness);
        sb.append("\nFactible: ").append(factible).append("\n");
        return sb.toString();
    }
}
