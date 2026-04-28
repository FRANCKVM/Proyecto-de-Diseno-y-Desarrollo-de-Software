package pucp.edu.pe.tasfb2b.algorithms.ga;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Grafo;

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

    public List<Aeropuerto> obtenerGenes() {
        return genes;
    }

    public double obtenerFitness() {
        return fitness;
    }

    public Ruta obtenerRuta() {
        return ruta;
    }

    public boolean esFactible() {
        return factible;
    }

    public void establecerGen(int indice, Aeropuerto aeropuerto) {
        genes.set(indice, aeropuerto);
    }

    public void agregarGen(Aeropuerto aeropuerto) {
        genes.add(aeropuerto);
    }

    public boolean contieneAeropuerto(Aeropuerto aeropuerto) {
        return genes.contains(aeropuerto);
    }

    public void evaluar(Grafo grafo, SolicitudEnvio solicitud) {
        Ruta rutaCandidato = new Ruta();
        boolean valido = true;

        if (genes.size() < 2) {
            this.fitness = 1_000_000;
            this.factible = false;
            this.ruta = rutaCandidato;
            return;
        }

        if (!genes.get(0).equals(solicitud.getOrigen()) ||
            !genes.get(genes.size() - 1).equals(solicitud.getDestino())) {

            this.fitness = 1_000_000 + genes.size() * 100;
            this.factible = false;
            this.ruta = rutaCandidato;
            return;
        }

        Set<Aeropuerto> visitados = new HashSet<>();
        int tiempoActualUtcMin = -1;

        for (int i = 0; i < genes.size() - 1; i++) {
            Aeropuerto desde = genes.get(i);
            Aeropuerto hasta = genes.get(i + 1);

            if (!visitados.add(desde)) {
                valido = false;
                break;
            }

            Vuelo vuelo = encontrarMejorVuelo(
                grafo,
                desde,
                hasta,
                solicitud.getContarBolsas(),
                tiempoActualUtcMin,
                rutaCandidato.getTiempoTotal(),
                solicitud.getDiasTiempoMaximo()
            );

            if (vuelo == null) {
                valido = false;
                break;
            }

            double incrementoDias = calcularIncrementoDias(vuelo, tiempoActualUtcMin);

            if (rutaCandidato.getTiempoTotal() + incrementoDias > solicitud.getDiasTiempoMaximo()) {
                valido = false;
                break;
            }

            rutaCandidato.agregarVuelo(vuelo, incrementoDias);
            tiempoActualUtcMin = calcularLlegadaAjustada(vuelo, tiempoActualUtcMin);
        }

        rutaCandidato.evaluar(solicitud);

        if (!rutaCandidato.esFactible()) {
            valido = false;
        }

        this.ruta = rutaCandidato;
        this.factible = valido;

        if (valido) {
            this.fitness = rutaCandidato.getCosto();
        } else {
            double penalizacion = 5000;
            penalizacion += genes.size() * 100;
            penalizacion += rutaCandidato.getTiempoTotal() * 500;

            this.fitness = rutaCandidato.getCosto() + penalizacion;
        }
    }

    private Vuelo encontrarMejorVuelo(
            Grafo grafo,
            Aeropuerto desde,
            Aeropuerto hasta,
            int bolsas,
            int tiempoActualUtcMin,
            double tiempoAcumuladoDias,
            double plazoMaximoDias
    ) {
        Vuelo mejorVuelo = null;
        double mejorIncremento = Double.MAX_VALUE;

        for (Vuelo vuelo : grafo.getVuelosSalientes(desde)) {
            if (!vuelo.getHasta().equals(hasta)) {
                continue;
            }

            if (vuelo.estaCancelado()) {
                continue;
            }

            if (!vuelo.tieneCapacidad(bolsas)) {
                continue;
            }

            double incrementoDias = calcularIncrementoDias(vuelo, tiempoActualUtcMin);

            if (incrementoDias <= 0) {
                continue;
            }

            if (tiempoAcumuladoDias + incrementoDias > plazoMaximoDias) {
                continue;
            }

            if (incrementoDias < mejorIncremento) {
                mejorIncremento = incrementoDias;
                mejorVuelo = vuelo;
            }
        }

        return mejorVuelo;
    }

    private double calcularIncrementoDias(Vuelo vuelo, int tiempoActualUtcMin) {
        int salida = vuelo.getSalidaUtcMin();
        int llegada = vuelo.getLlegadaUtcMin();

        while (llegada <= salida) {
            llegada += 1440;
        }

        if (tiempoActualUtcMin == -1) {
            return (llegada - salida) / 1440.0;
        }

        while (salida < tiempoActualUtcMin) {
            salida += 1440;
            llegada += 1440;
        }

        while (llegada <= salida) {
            llegada += 1440;
        }

        return (llegada - tiempoActualUtcMin) / 1440.0;
    }

    private int calcularLlegadaAjustada(Vuelo vuelo, int tiempoActualUtcMin) {
        int salida = vuelo.getSalidaUtcMin();
        int llegada = vuelo.getLlegadaUtcMin();

        while (llegada <= salida) {
            llegada += 1440;
        }

        if (tiempoActualUtcMin == -1) {
            return llegada;
        }

        while (salida < tiempoActualUtcMin) {
            salida += 1440;
            llegada += 1440;
        }

        while (llegada <= salida) {
            llegada += 1440;
        }

        return llegada;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();

        sb.append("Cromosoma: ");

        for (Aeropuerto aeropuerto : genes) {
            sb.append(aeropuerto.getCodigo()).append(" ");
        }

        sb.append("\nFitness: ").append(fitness);
        sb.append("\nFactible: ").append(factible);
        sb.append("\n");

        return sb.toString();
    }
}