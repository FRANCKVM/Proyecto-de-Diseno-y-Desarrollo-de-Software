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

    public Aeropuerto getOrigen() {
        return origen;
    }

    public Aeropuerto getDestino() {
        return destino;
    }

    public int getContarBolsas() {
        return contarBolsas;
    }

    public double getDiasTiempoMaximo() {
        return diasTiempoMaximo;
    }
}
