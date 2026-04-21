import java.util.*;

public class PlanificadorGenetico {
    private final Grafo grafo;
    private final List<Aeropuerto> aeropuertos;
    private final int tamanoPoblacion;
    private final int generaciones;
    private final double tasaCruzamiento;
    private final double tasaMutacion;
    private final int tamanTorneo;
    private final int escalasIntermediasMax;
    private final Random aleatorio;

    public PlanificadorGenetico(Grafo grafo,
                                int tamanoPoblacion,
                                int generaciones,
                                double tasaCruzamiento,
                                double tasaMutacion,
                                int tamanTorneo,
                                int escalasIntermediasMax) {
        this.grafo = grafo;
        this.aeropuertos = new ArrayList<>(grafo.getAirports());
        this.tamanoPoblacion = tamanoPoblacion;
        this.generaciones = generaciones;
        this.tasaCruzamiento = tasaCruzamiento;
        this.tasaMutacion = tasaMutacion;
        this.tamanTorneo = tamanTorneo;
        this.escalasIntermediasMax = escalasIntermediasMax;
        this.aleatorio = new Random();
    }

    public Ruta findBestRoute(SolicitudEnvio solicitud) {
        List<Cromosoma> poblacion = inicializarPoblacion(solicitud);
        evaluarPoblacion(poblacion, solicitud);

        Cromosoma mejorGlobal = obtenerMejor(poblacion);

        for (int generacion = 0; generacion < generaciones; generacion++) {
            List<Cromosoma> nuevaPoblacion = new ArrayList<>();

            // 🔥 Elitismo
            Cromosoma elite = new Cromosoma(mejorGlobal);
            elite.evaluate(grafo, solicitud);
            nuevaPoblacion.add(elite);

            while (nuevaPoblacion.size() < tamanoPoblacion) {
                Cromosoma padre1 = seleccionTorneo(poblacion);
                Cromosoma padre2 = seleccionTorneo(poblacion);

                Cromosoma hijo;
                if (aleatorio.nextDouble() < tasaCruzamiento) {
                    hijo = cruzar(padre1, padre2, solicitud);
                } else {
                    hijo = new Cromosoma(padre1);
                }

                if (aleatorio.nextDouble() < tasaMutacion) {
                    mutar(hijo, solicitud);
                }

                hijo.evaluate(grafo, solicitud);
                nuevaPoblacion.add(hijo);
            }

            poblacion = nuevaPoblacion;

            Cromosoma mejorGeneracion = obtenerMejor(poblacion);

            if (mejorGeneracion.getFitness() < mejorGlobal.getFitness()) {
                mejorGlobal = new Cromosoma(mejorGeneracion);
            }

            System.out.println("Generación " + (generacion + 1) +
                    " | mejor fitness: " + mejorGlobal.getFitness() +
					" | población: " + poblacion.size());
        }

        return mejorGlobal.getRoute();
    }

    private List<Cromosoma> inicializarPoblacion(SolicitudEnvio solicitud) {
        List<Cromosoma> poblacion = new ArrayList<>();

        for (int i = 0; i < tamanoPoblacion; i++) {
            poblacion.add(crearCromosomAleatorio(solicitud));
        }

        return poblacion;
    }

    private Cromosoma crearCromosomAleatorio(SolicitudEnvio solicitud) {
        List<Aeropuerto> candidatos = new ArrayList<>(aeropuertos);
        candidatos.remove(solicitud.getOrigin());
        candidatos.remove(solicitud.getDestination());

        Collections.shuffle(candidatos, aleatorio);

        int contarIntermedio = aleatorio.nextInt(escalasIntermediasMax + 1);

        List<Aeropuerto> genes = new ArrayList<>();
        genes.add(solicitud.getOrigin());

        for (int i = 0; i < contarIntermedio && i < candidatos.size(); i++) {
            genes.add(candidatos.get(i));
        }

        genes.add(solicitud.getDestination());

        return new Cromosoma(genes);
    }

    private void evaluarPoblacion(List<Cromosoma> poblacion, SolicitudEnvio solicitud) {
        for (Cromosoma cromosoma : poblacion) {
            cromosoma.evaluate(grafo, solicitud);
        }
    }

    // 🔥 Prioriza factibles
    private Cromosoma obtenerMejor(List<Cromosoma> poblacion) {
        return poblacion.stream()
                .min(Comparator
                        .comparing(Cromosoma::isFeasible).reversed()
                        .thenComparingDouble(Cromosoma::getFitness))
                .orElseThrow();
    }

    private Cromosoma seleccionTorneo(List<Cromosoma> poblacion) {
        List<Cromosoma> torneo = new ArrayList<>();

        for (int i = 0; i < tamanTorneo; i++) {
            torneo.add(poblacion.get(aleatorio.nextInt(poblacion.size())));
        }

        return obtenerMejor(torneo);
    }

    private Cromosoma cruzar(Cromosoma p1, Cromosoma p2, SolicitudEnvio solicitud) {
        List<Aeropuerto> medio1 = obtenerGenesIntermedios(p1.getGenes());
        List<Aeropuerto> medio2 = obtenerGenesIntermedios(p2.getGenes());

        List<Aeropuerto> medioHijo = new ArrayList<>();

        for (Aeropuerto a : medio1) {
            if (aleatorio.nextBoolean() && !medioHijo.contains(a)) {
                medioHijo.add(a);
            }
        }

        for (Aeropuerto a : medio2) {
            if (aleatorio.nextBoolean() && !medioHijo.contains(a)) {
                medioHijo.add(a);
            }
        }

        if (medioHijo.size() > escalasIntermediasMax) {
            medioHijo = medioHijo.subList(0, escalasIntermediasMax);
        }

        List<Aeropuerto> genes = new ArrayList<>();
        genes.add(solicitud.getOrigin());
        genes.addAll(medioHijo);
        genes.add(solicitud.getDestination());

        return new Cromosoma(genes);
    }

    private List<Aeropuerto> obtenerGenesIntermedios(List<Aeropuerto> genes) {
        if (genes.size() <= 2) return new ArrayList<>();
        return new ArrayList<>(genes.subList(1, genes.size() - 1));
    }

    private void mutar(Cromosoma cromosoma, SolicitudEnvio solicitud) {
        List<Aeropuerto> genes = cromosoma.getGenes();

        if (genes.size() <= 2) {
            agregarIntermediaAleatorio(genes, solicitud);
            return;
        }

        int tipo = aleatorio.nextInt(3);

        switch (tipo) {
            case 0 -> intercambiarIntermedia(genes);
            case 1 -> eliminarIntermedia(genes);
            case 2 -> agregarIntermediaAleatorio(genes, solicitud);
        }
    }

    private void intercambiarIntermedia(List<Aeropuerto> genes) {
        if (genes.size() <= 3) return;

        int i = 1 + aleatorio.nextInt(genes.size() - 2);
        int j = 1 + aleatorio.nextInt(genes.size() - 2);

        Collections.swap(genes, i, j);
    }

    private void eliminarIntermedia(List<Aeropuerto> genes) {
        if (genes.size() > 2) {
            int indice = 1 + aleatorio.nextInt(genes.size() - 2);
            genes.remove(indice);
        }
    }

    private void agregarIntermediaAleatorio(List<Aeropuerto> genes, SolicitudEnvio solicitud) {
        if (genes.size() - 2 >= escalasIntermediasMax) return;

        List<Aeropuerto> disponibles = new ArrayList<>(aeropuertos);
        disponibles.remove(solicitud.getOrigin());
        disponibles.remove(solicitud.getDestination());
        disponibles.removeAll(genes);

        if (disponibles.isEmpty()) return;

        Aeropuerto nuevoAeropuerto = disponibles.get(aleatorio.nextInt(disponibles.size()));
        int pos = 1 + aleatorio.nextInt(genes.size() - 1);
        genes.add(pos, nuevoAeropuerto);
    }
}
