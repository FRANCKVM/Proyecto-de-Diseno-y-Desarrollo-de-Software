package pucp.edu.pe.tasfb2b.algorithms.ga;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.entities.Grafo;
import pucp.edu.pe.tasfb2b.entities.Ruta;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;

public class Cromosoma {
    private final List<Aeropuerto> genes;
    private double fitness;
    private Ruta ruta;
    private boolean factible;

    public Cromosoma() {
        this(new ArrayList<>());
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

    public List<Aeropuerto> obtenerGenes() { return genes; }
    public double obtenerFitness() { return fitness; }
    public Ruta obtenerRuta() { return ruta; }
    public boolean esFactible() { return factible; }
    public void establecerGen(int indice, Aeropuerto aeropuerto) { genes.set(indice, aeropuerto); }
    public void agregarGen(Aeropuerto aeropuerto) { genes.add(aeropuerto); }
    public boolean contieneAeropuerto(Aeropuerto aeropuerto) { return genes.contains(aeropuerto); }

    public void evaluar(Grafo grafo, SolicitudEnvio solicitud) {
        evaluar(grafo, solicitud, solicitud.getFechaHoraRegistro(), 0);
    }

    public void evaluar(Grafo grafo, SolicitudEnvio solicitud, LocalDateTime fechaHoraInicio) {
        evaluar(grafo, solicitud, fechaHoraInicio, 0);
    }

    public void evaluar(
            Grafo grafo,
            SolicitudEnvio solicitud,
            LocalDateTime fechaHoraInicio,
            int minutosEsperaMinimaEscala
    ) {
        Ruta rutaCandidato = new Ruta();
        boolean valido = true;

        if (genes.size() < 2
                || !genes.getFirst().equals(solicitud.getOrigen())
                || !genes.getLast().equals(solicitud.getDestino())) {
            this.fitness = 1_000_000 + genes.size() * 100;
            this.factible = false;
            this.ruta = rutaCandidato;
            return;
        }

        LocalDateTime cursor = fechaHoraInicio != null ? fechaHoraInicio : solicitud.getFechaHoraRegistro();
        if (cursor == null) {
            throw new IllegalArgumentException("La solicitud debe tener fecha y hora para elegir una ocurrencia.");
        }

        Set<Aeropuerto> visitados = new HashSet<>();
        for (int i = 0; i < genes.size() - 1; i++) {
            Aeropuerto desde = genes.get(i);
            Aeropuerto hasta = genes.get(i + 1);
            LocalDateTime salidaMinima = i == 0
                    ? cursor
                    : cursor.plusMinutes(Math.max(0, minutosEsperaMinimaEscala));
            if (!visitados.add(desde)) {
                valido = false;
                break;
            }

            VueloOcurrencia ocurrencia = encontrarMejorOcurrencia(
                    grafo,
                    desde,
                    hasta,
                    solicitud.getContarBolsas(),
                    salidaMinima,
                    cursor,
                    rutaCandidato.getTiempoTotal(),
                    solicitud.getDiasTiempoMaximo()
            );
            if (ocurrencia == null) {
                valido = false;
                break;
            }

            double incrementoDias = Duration.between(cursor, ocurrencia.getFechaHoraLlegada()).toMinutes() / 1440.0;
            if (rutaCandidato.getTiempoTotal() + incrementoDias > solicitud.getDiasTiempoMaximo()) {
                valido = false;
                break;
            }
            rutaCandidato.agregarOcurrencia(ocurrencia, incrementoDias);
            cursor = ocurrencia.getFechaHoraLlegada();
        }

        rutaCandidato.evaluar(solicitud);
        if (!rutaCandidato.esFactible()) {
            valido = false;
        }

        this.ruta = rutaCandidato;
        this.factible = valido;
        this.fitness = valido
                ? rutaCandidato.getCosto()
                : rutaCandidato.getCosto() + 5000 + genes.size() * 100 + rutaCandidato.getTiempoTotal() * 500;
    }

    private VueloOcurrencia encontrarMejorOcurrencia(
            Grafo grafo,
            Aeropuerto desde,
            Aeropuerto hasta,
            int bolsas,
            LocalDateTime salidaMinima,
            LocalDateTime cursor,
            double tiempoAcumuladoDias,
            double plazoMaximoDias
    ) {
        VueloOcurrencia mejor = null;
        double mejorIncremento = Double.MAX_VALUE;

        for (VueloOcurrencia ocurrencia : grafo.getOcurrenciasSalientes(desde)) {
            Vuelo vuelo = ocurrencia.getVuelo();
            if (!vuelo.getHasta().equals(hasta)
                    || ocurrencia.getFechaHoraSalida().isBefore(salidaMinima)
                    || !ocurrencia.tieneCapacidad(bolsas)) {
                continue;
            }
            double incremento = Duration.between(cursor, ocurrencia.getFechaHoraLlegada()).toMinutes() / 1440.0;
            if (incremento <= 0 || tiempoAcumuladoDias + incremento > plazoMaximoDias) {
                continue;
            }
            if (incremento < mejorIncremento) {
                mejorIncremento = incremento;
                mejor = ocurrencia;
            }
        }
        return mejor;
    }

    @Override
    public String toString() {
        return "Cromosoma: " + genes + "\nFitness: " + fitness + "\nFactible: " + factible + "\n";
    }
}
