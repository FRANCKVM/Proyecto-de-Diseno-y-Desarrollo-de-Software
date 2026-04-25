import java.util.ArrayList;
import java.util.List;

public class PlanificadorACO {
    private final Grafo grafo;
    private final List<Aeropuerto> indiceAeropuertos;
    private final double[][] feromonas;

    private final int contarHormigas;
    private final int iteraciones;
    private final double alfa;
    private final double beta;
    private final double evaporacion;
    private final double q;
    private final int saltosMaximos;

    public PlanificadorACO(Grafo grafo,
                           int contarHormigas,
                           int iteraciones,
                           double alfa,
                           double beta,
                           double evaporacion,
                           double q,
                           int saltosMaximos) {
        this.grafo = grafo;
        this.contarHormigas = contarHormigas;
        this.iteraciones = iteraciones;
        this.alfa = alfa;
        this.beta = beta;
        this.evaporacion = evaporacion;
        this.q = q;
        this.saltosMaximos = saltosMaximos;

        this.indiceAeropuertos = new ArrayList<>(grafo.getAeropuertos());
        int n = indiceAeropuertos.size();
        this.feromonas = new double[n][n];

        inicializarFeromonas();
    }

    private void inicializarFeromonas() {
        for (int i = 0; i < feromonas.length; i++) {
            for (int j = 0; j < feromonas[i].length; j++) {
                feromonas[i][j] = 1.0;
            }
        }
    }

    public Ruta encontrarMejorRuta(SolicitudEnvio solicitud) {
        Ruta mejorGlobal = null;

        for (int iter = 0; iter < iteraciones; iter++) {
            List<Ruta> rutas = new ArrayList<>();
            Ruta mejorIteracion = null;

            for (int k = 0; k < contarHormigas; k++) {
                Hormiga hormiga = new Hormiga(grafo, solicitud, feromonas, indiceAeropuertos, alfa, beta);
                Ruta ruta = hormiga.construirRuta(saltosMaximos);
                rutas.add(ruta);

                if (mejorIteracion == null || ruta.getCosto() < mejorIteracion.getCosto()) {
                    mejorIteracion = ruta;
                }
            }

            evaporar();

            for (Ruta ruta : rutas) {
                if (ruta.esFactible()) {
                    depositar(ruta);
                }
            }

            if (mejorIteracion != null &&
                (mejorGlobal == null || mejorIteracion.getCosto() < mejorGlobal.getCosto())) {
                mejorGlobal = new Ruta(mejorIteracion);
            }
			/*
            System.out.println("Iteración " + (iter + 1) + " | mejor costo: " 
					+ (mejorIteracion != null ? mejorIteracion.getCosto() : "N/A"
					+ " | rutas generadas: " + rutas.size()));*/
        }

        return mejorGlobal;
    }

    private void evaporar() {
        for (int i = 0; i < feromonas.length; i++) {
            for (int j = 0; j < feromonas[i].length; j++) {
                feromonas[i][j] *= (1.0 - evaporacion);
                if (feromonas[i][j] < 0.0001) {
                    feromonas[i][j] = 0.0001;
                }
            }
        }
    }

    private void depositar(Ruta ruta) {
        double aporte = q / (ruta.getCosto() + 0.0001);

        for (Vuelo v : ruta.getVuelos()) {
            int i = indiceAeropuertos.indexOf(v.getDesde());
            int j = indiceAeropuertos.indexOf(v.getHasta());
            feromonas[i][j] += aporte;
        }
    }
}
