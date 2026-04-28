package pucp.edu.pe.tasfb2b.algorithms.ga;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;

public class PlanificadorGenetico {
    private final Grafo grafo;
    
    private final int tamanoPoblacion;
    private final int generaciones;
    private final double tasaCruzamiento;
    private final double tasaMutacion;
    private final int tamanoTorneo;
    private final int escalasIntermediasMax;
    private final Random aleatorio;

    public PlanificadorGenetico(Grafo grafo,
                                int tamanoPoblacion,
                                int generaciones,
                                double tasaCruzamiento,
                                double tasaMutacion,
                                int tamanoTorneo,
                                int escalasIntermediasMax) {
        this.grafo = grafo;
        this.tamanoPoblacion = tamanoPoblacion;
        this.generaciones = generaciones;
        this.tasaCruzamiento = tasaCruzamiento;
        this.tasaMutacion = tasaMutacion;
        this.tamanoTorneo = tamanoTorneo;
        this.escalasIntermediasMax = escalasIntermediasMax;
        this.aleatorio = new Random();
    }

    public Ruta encontrarMejorRuta(SolicitudEnvio solicitud) {
        List<Cromosoma> poblacion = inicializarPoblacion(solicitud);
        evaluarPoblacion(poblacion, solicitud);

        Cromosoma mejorGlobal = obtenerMejor(poblacion);

        for (int generacion = 0; generacion < generaciones; generacion++) {
            List<Cromosoma> nuevaPoblacion = new ArrayList<>();

            // Elitismo: se conserva el mejor cromosoma encontrado.
            Cromosoma elite = new Cromosoma(mejorGlobal);
            elite.evaluar(grafo, solicitud);
            nuevaPoblacion.add(elite);

            while (nuevaPoblacion.size() < tamanoPoblacion) {
                Cromosoma padre1 = seleccionarPorTorneo(poblacion);
                Cromosoma padre2 = seleccionarPorTorneo(poblacion);

                Cromosoma hijo;

                if (aleatorio.nextDouble() < tasaCruzamiento) {
                    hijo = cruzar(padre1, padre2, solicitud);
                } else {
                    hijo = new Cromosoma(padre1);
                }

                if (aleatorio.nextDouble() < tasaMutacion) {
                    mutar(hijo, solicitud);
                }

                hijo.evaluar(grafo, solicitud);
                nuevaPoblacion.add(hijo);
            }

            poblacion = nuevaPoblacion;

            Cromosoma mejorGeneracion = obtenerMejor(poblacion);

            if (mejorGeneracion.esFactible() &&
                (!mejorGlobal.esFactible() ||
                 mejorGeneracion.obtenerFitness() < mejorGlobal.obtenerFitness())) {
                mejorGlobal = new Cromosoma(mejorGeneracion);
            }

            /*
            System.out.println("Generación " + (generacion + 1)
                    + " | mejor fitness: " + mejorGlobal.obtenerFitness()
                    + " | factible: " + mejorGlobal.esFactible()
                    + " | población: " + poblacion.size());
            */
        }

        if (mejorGlobal != null && mejorGlobal.esFactible()) {
            return mejorGlobal.obtenerRuta();
        }

        return null;
    }

    private List<Cromosoma> inicializarPoblacion(SolicitudEnvio solicitud) {
        List<Cromosoma> poblacion = new ArrayList<>();

        // Primero se agrega la ruta directa: origen -> destino.
        // Esto permite que el GA pruebe desde el inicio la solución más simple.
        poblacion.add(crearCromosomaDirecto(solicitud));

        while (poblacion.size() < tamanoPoblacion) {
            poblacion.add(crearCromosomaAleatorioOrientado(solicitud));
        }

        return poblacion;
    }

    private Cromosoma crearCromosomaDirecto(SolicitudEnvio solicitud) {
        List<Aeropuerto> genes = new ArrayList<>();
        genes.add(solicitud.getOrigen());
        genes.add(solicitud.getDestino());

        return new Cromosoma(genes);
    }

    private Cromosoma crearCromosomaAleatorioOrientado(SolicitudEnvio solicitud) {
        List<Aeropuerto> genes = new ArrayList<>();
        List<Aeropuerto> visitados = new ArrayList<>();

        Aeropuerto actual = solicitud.getOrigen();
        Aeropuerto destino = solicitud.getDestino();

        genes.add(actual);
        visitados.add(actual);

        int cantidadIntermedios = aleatorio.nextInt(escalasIntermediasMax + 1);

        for (int i = 0; i < cantidadIntermedios; i++) {
            List<Aeropuerto> candidatos = obtenerAeropuertosSiguientes(
                actual,
                solicitud,
                visitados
            );

            if (candidatos.isEmpty()) {
                break;
            }

            Aeropuerto siguiente = seleccionarAeropuertoOrientado(
                actual,
                candidatos,
                solicitud
            );

            if (siguiente.equals(destino)) {
                genes.add(destino);
                return new Cromosoma(genes);
            }

            genes.add(siguiente);
            visitados.add(siguiente);
            actual = siguiente;
        }

        if (!genes.get(genes.size() - 1).equals(destino)) {
            genes.add(destino);
        }

        return new Cromosoma(genes);
    }

    private List<Aeropuerto> obtenerAeropuertosSiguientes(
            Aeropuerto actual,
            SolicitudEnvio solicitud,
            List<Aeropuerto> visitados
    ) {
        List<Aeropuerto> candidatos = new ArrayList<>();

        for (Vuelo vuelo : grafo.getVuelosSalientes(actual)) {
            if (vuelo.estaCancelado()) {
                continue;
            }

            if (!vuelo.tieneCapacidad(solicitud.getContarBolsas())) {
                continue;
            }

            Aeropuerto siguiente = vuelo.getHasta();

            if (visitados.contains(siguiente)) {
                continue;
            }

            if (!candidatos.contains(siguiente)) {
                candidatos.add(siguiente);
            }
        }

        return candidatos;
    }

    private Aeropuerto seleccionarAeropuertoOrientado(
            Aeropuerto actual,
            List<Aeropuerto> candidatos,
            SolicitudEnvio solicitud
    ) {
        Aeropuerto destino = solicitud.getDestino();

        // Si existe vuelo directo al destino, se favorece fuertemente.
        if (candidatos.contains(destino) && aleatorio.nextDouble() < 0.70) {
            return destino;
        }

        double[] pesos = new double[candidatos.size()];
        double suma = 0.0;

        for (int i = 0; i < candidatos.size(); i++) {
            Aeropuerto candidato = candidatos.get(i);

            double peso = calcularPesoAeropuerto(actual, candidato, destino);
            pesos[i] = peso;
            suma += peso;
        }

        if (suma == 0.0) {
            return candidatos.get(aleatorio.nextInt(candidatos.size()));
        }

        double r = aleatorio.nextDouble() * suma;
        double acumulado = 0.0;

        for (int i = 0; i < candidatos.size(); i++) {
            acumulado += pesos[i];

            if (r <= acumulado) {
                return candidatos.get(i);
            }
        }

        return candidatos.get(candidatos.size() - 1);
    }

    private double calcularPesoAeropuerto(
            Aeropuerto actual,
            Aeropuerto candidato,
            Aeropuerto destino
    ) {
        if (candidato.equals(destino)) {
            return 10.0;
        }

        String regionActual = actual.getRegion();
        String regionCandidato = candidato.getRegion();
        String regionDestino = destino.getRegion();

        if (regionActual == null || regionCandidato == null || regionDestino == null ||
            regionActual.equals("N/A") || regionCandidato.equals("N/A") || regionDestino.equals("N/A")) {
            return 1.0;
        }

        // Si el candidato está en la región del destino, se favorece.
        if (regionCandidato.equals(regionDestino)) {
            return 5.0;
        }

        // Si el destino está en otra región y sigo en la misma región actual,
        // se penaliza para evitar dar vueltas innecesarias.
        if (!regionActual.equals(regionDestino) && regionCandidato.equals(regionActual)) {
            return 0.5;
        }

        // Si va hacia una tercera región, puede ser escala, pero no se premia tanto.
        return 1.0;
    }

    private void evaluarPoblacion(List<Cromosoma> poblacion, SolicitudEnvio solicitud) {
        for (Cromosoma cromosoma : poblacion) {
            cromosoma.evaluar(grafo, solicitud);
        }
    }

    private Cromosoma obtenerMejor(List<Cromosoma> poblacion) {
        return poblacion.stream()
                .min(Comparator
                        .comparing(Cromosoma::esFactible).reversed()
                        .thenComparingDouble(Cromosoma::obtenerFitness))
                .orElseThrow();
    }

    private Cromosoma seleccionarPorTorneo(List<Cromosoma> poblacion) {
        List<Cromosoma> torneo = new ArrayList<>();

        for (int i = 0; i < tamanoTorneo; i++) {
            torneo.add(poblacion.get(aleatorio.nextInt(poblacion.size())));
        }

        return obtenerMejor(torneo);
    }

    private Cromosoma cruzar(Cromosoma padre1, Cromosoma padre2, SolicitudEnvio solicitud) {
        List<Aeropuerto> intermedios1 = obtenerGenesIntermedios(padre1.obtenerGenes());
        List<Aeropuerto> intermedios2 = obtenerGenesIntermedios(padre2.obtenerGenes());

        List<Aeropuerto> intermediosHijo = new ArrayList<>();

        for (Aeropuerto aeropuerto : intermedios1) {
            if (aleatorio.nextBoolean() && !intermediosHijo.contains(aeropuerto)) {
                intermediosHijo.add(aeropuerto);
            }
        }

        for (Aeropuerto aeropuerto : intermedios2) {
            if (aleatorio.nextBoolean() && !intermediosHijo.contains(aeropuerto)) {
                intermediosHijo.add(aeropuerto);
            }
        }

        Collections.shuffle(intermediosHijo, aleatorio);

        if (intermediosHijo.size() > escalasIntermediasMax) {
            intermediosHijo = new ArrayList<>(intermediosHijo.subList(0, escalasIntermediasMax));
        }

        List<Aeropuerto> genes = new ArrayList<>();
        genes.add(solicitud.getOrigen());
        genes.addAll(intermediosHijo);
        genes.add(solicitud.getDestino());

        return new Cromosoma(genes);
    }

    private List<Aeropuerto> obtenerGenesIntermedios(List<Aeropuerto> genes) {
        if (genes.size() <= 2) {
            return new ArrayList<>();
        }

        return new ArrayList<>(genes.subList(1, genes.size() - 1));
    }

    private void mutar(Cromosoma cromosoma, SolicitudEnvio solicitud) {
        List<Aeropuerto> genes = cromosoma.obtenerGenes();

        int tipo = aleatorio.nextInt(3);

        switch (tipo) {
            case 0 -> intercambiarIntermedios(genes);
            case 1 -> eliminarIntermedio(genes);
            case 2 -> agregarIntermedioOrientado(genes, solicitud);
        }
    }

    private void intercambiarIntermedios(List<Aeropuerto> genes) {
        if (genes.size() <= 3) {
            return;
        }

        int i = 1 + aleatorio.nextInt(genes.size() - 2);
        int j = 1 + aleatorio.nextInt(genes.size() - 2);

        Collections.swap(genes, i, j);
    }

    private void eliminarIntermedio(List<Aeropuerto> genes) {
        if (genes.size() > 2) {
            int indice = 1 + aleatorio.nextInt(genes.size() - 2);
            genes.remove(indice);
        }
    }

    private void agregarIntermedioOrientado(List<Aeropuerto> genes, SolicitudEnvio solicitud) {
        if (genes.size() - 2 >= escalasIntermediasMax) {
            return;
        }

        if (genes.size() < 2) {
            return;
        }

        int posicion = 1 + aleatorio.nextInt(genes.size() - 1);

        Aeropuerto anterior = genes.get(posicion - 1);
        Aeropuerto siguienteActual = genes.get(posicion);

        List<Aeropuerto> candidatos = obtenerCandidatosParaInsertar(
            anterior,
            siguienteActual,
            genes,
            solicitud
        );

        if (candidatos.isEmpty()) {
            return;
        }

        Aeropuerto nuevo = seleccionarAeropuertoOrientado(
            anterior,
            candidatos,
            solicitud
        );

        genes.add(posicion, nuevo);
    }

    private List<Aeropuerto> obtenerCandidatosParaInsertar(
            Aeropuerto anterior,
            Aeropuerto siguienteActual,
            List<Aeropuerto> genes,
            SolicitudEnvio solicitud
    ) {
        List<Aeropuerto> candidatos = new ArrayList<>();
        List<Aeropuerto> candidatosConConexion = new ArrayList<>();

        for (Vuelo vuelo : grafo.getVuelosSalientes(anterior)) {
            if (vuelo.estaCancelado()) {
                continue;
            }

            if (!vuelo.tieneCapacidad(solicitud.getContarBolsas())) {
                continue;
            }

            Aeropuerto candidato = vuelo.getHasta();

            if (genes.contains(candidato)) {
                continue;
            }

            if (candidato.equals(solicitud.getOrigen()) ||
                candidato.equals(solicitud.getDestino())) {
                continue;
            }

            if (!candidatos.contains(candidato)) {
                candidatos.add(candidato);
            }

            if (existeVuelo(candidato, siguienteActual, solicitud.getContarBolsas()) &&
                !candidatosConConexion.contains(candidato)) {
                candidatosConConexion.add(candidato);
            }
        }

        if (!candidatosConConexion.isEmpty()) {
            return candidatosConConexion;
        }

        return candidatos;
    }

    private boolean existeVuelo(Aeropuerto desde, Aeropuerto hasta, int bolsas) {
        for (Vuelo vuelo : grafo.getVuelosSalientes(desde)) {
            if (vuelo.getHasta().equals(hasta) &&
                !vuelo.estaCancelado() &&
                vuelo.tieneCapacidad(bolsas)) {
                return true;
            }
        }

        return false;
    }
}