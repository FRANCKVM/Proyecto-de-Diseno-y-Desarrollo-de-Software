import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

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

        while (!actual.equals(solicitud.getDestino()) && saltos < saltosMaximos) {
            List<Vuelo> candidatos = grafo.getVuelosSalientes(actual).stream()
				.filter(v -> !v.estaCancelado())
				.filter(v -> v.tieneCapacidad(solicitud.getContarBolsas()))
				.filter(v -> !visitados.contains(v.getHasta()))
				.filter(v -> ruta.getTiempoTotal() + v.getTiempoViajarDias() <= solicitud.getDiasTiempoMaximo())
				.toList();

            if (candidatos.isEmpty()) {
                break;
            }

            Vuelo seleccionado = seleccionarSiguienteVuelo(actual, candidatos);
            if (seleccionado == null) {
                break;
            }

            ruta.agregarVuelo(seleccionado);
            actual = seleccionado.getHasta();
            visitados.add(actual);
            saltos++;
        }

        ruta.evaluar(solicitud);
        return ruta;
    }

    private Vuelo seleccionarSiguienteVuelo(Aeropuerto actual, List<Vuelo> candidatos) {
        int i = indiceAeropuertos.indexOf(actual);

        double[] probabilidades = new double[candidatos.size()];
        double suma = 0.0;

        for (int k = 0; k < candidatos.size(); k++) {
            Vuelo v = candidatos.get(k);
            int j = indiceAeropuertos.indexOf(v.getHasta());
			
			if (v.getTiempoViajarDias() <= 0) continue;

            double tau = Math.pow(feromonas[i][j], alfa);
            double eta = Math.pow(1.0 / (v.getTiempoViajarDias() * (1 + 0.2 * candidatos.size())), beta);

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
}
