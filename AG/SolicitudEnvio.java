public class SolicitudEnvio {
    private final Aeropuerto origen;
    private final Aeropuerto destino;
    private final int contarBolsas;
    private final double diasTiempoMaximo;

    public SolicitudEnvio(Aeropuerto origen, Aeropuerto destino, int contarBolsas, double diasTiempoMaximo) {
        this.origen = origen;
        this.destino = destino;
        this.contarBolsas = contarBolsas;
        this.diasTiempoMaximo = diasTiempoMaximo;
    }

    public Aeropuerto getOrigin() {
        return origen;
    }

    public Aeropuerto getDestination() {
        return destino;
    }

    public int getBagCount() {
        return contarBolsas;
    }

    public double getMaxTimeDays() {
        return diasTiempoMaximo;
    }
}
