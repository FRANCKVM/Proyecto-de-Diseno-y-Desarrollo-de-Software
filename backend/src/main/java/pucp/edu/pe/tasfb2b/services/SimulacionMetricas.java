package pucp.edu.pe.tasfb2b.services;

public class SimulacionMetricas {

    private int bloquesProcesados;
    private int totalConsumidas;
    private int resueltas;
    private int noResueltas;
    private int noResueltasPorAlmacenOrigen;
    private int noResueltasPorRutaVueloPlazo;
    private int rutasDirectas;
    private int rutasConParada;
    private int totalVuelosUsados;
    private int totalEscalas;

    private double costoTotalRutas;
    private long tiempoPlanificacionTotalNs;

    public void reiniciar() {
        bloquesProcesados = 0;
        totalConsumidas = 0;
        resueltas = 0;
        noResueltas = 0;
        noResueltasPorAlmacenOrigen = 0;
        noResueltasPorRutaVueloPlazo = 0;
        rutasDirectas = 0;
        rutasConParada = 0;
        totalVuelosUsados = 0;
        totalEscalas = 0;
        costoTotalRutas = 0.0;
        tiempoPlanificacionTotalNs = 0;
    }

    public void incrementarBloquesProcesados() {
        bloquesProcesados++;
    }

    public void incrementarTotalConsumidas() {
        totalConsumidas++;
    }

    public void incrementarNoResueltasPorAlmacenOrigen() {
        noResueltas++;
        noResueltasPorAlmacenOrigen++;
    }

    public void incrementarNoResueltasPorRutaVueloPlazo() {
        noResueltas++;
        noResueltasPorRutaVueloPlazo++;
    }

    public void registrarTiempoPlanificacion(long tiempoNs) {
        tiempoPlanificacionTotalNs += tiempoNs;
    }

    public void registrarRutaResuelta(double costoRuta, int cantidadVuelos) {
        resueltas++;
        costoTotalRutas += costoRuta;
        totalVuelosUsados += cantidadVuelos;

        int cantidadEscalas = Math.max(0, cantidadVuelos - 1);
        totalEscalas += cantidadEscalas;

        if (cantidadVuelos == 1) {
            rutasDirectas++;
        } else {
            rutasConParada++;
        }
    }

    public int getBloquesProcesados() {
        return bloquesProcesados;
    }

    public int getTotalConsumidas() {
        return totalConsumidas;
    }

    public int getResueltas() {
        return resueltas;
    }

    public int getNoResueltas() {
        return noResueltas;
    }

    public int getNoResueltasPorAlmacenOrigen() {
        return noResueltasPorAlmacenOrigen;
    }

    public int getNoResueltasPorRutaVueloPlazo() {
        return noResueltasPorRutaVueloPlazo;
    }

    public int getRutasDirectas() {
        return rutasDirectas;
    }

    public int getRutasConParada() {
        return rutasConParada;
    }

    public int getTotalVuelosUsados() {
        return totalVuelosUsados;
    }

    public int getTotalEscalas() {
        return totalEscalas;
    }

    public double getCostoTotalRutas() {
        return costoTotalRutas;
    }

    public long getTiempoPlanificacionTotalNs() {
        return tiempoPlanificacionTotalNs;
    }
}
