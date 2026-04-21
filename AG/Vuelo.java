public class Vuelo {
    private final Aeropuerto desde;
    private final Aeropuerto hasta;
    private final double tiempoViajarDias;
    private final int capacidad;
    private int capacidadUsada;
    private boolean cancelado;

    public Vuelo(Aeropuerto desde, Aeropuerto hasta, double tiempoViajarDias, int capacidad) {
        this.desde = desde;
        this.hasta = hasta;
        this.tiempoViajarDias = tiempoViajarDias;
        this.capacidad = capacidad;
        this.capacidadUsada = 0;
        this.cancelado = false;
    }

    public Aeropuerto getDesde() {
        return desde;
    }

    public Aeropuerto getHasta() {
        return hasta;
    }

    public double getTiempoViajarDias() {
        return tiempoViajarDias;
    }

    public int getCapacidad() {
        return capacidad;
    }

    public int getCapacidadDisponible() {
        return capacidad - capacidadUsada;
    }

    public boolean tieneCapacidad(int bolsas) {
        return !cancelado && getCapacidadDisponible() >= bolsas;
    }

    public void reservar(int bolsas) {
        if (!tieneCapacidad(bolsas)) {
            throw new IllegalStateException("No hay capacidad suficiente en el vuelo.");
        }
        capacidadUsada += bolsas;
    }

    public boolean estaCancelado() {
        return cancelado;
    }

    public void setCancelado(boolean cancelado) {
        this.cancelado = cancelado;
    }

    @Override
    public String toString() {
        return desde.getCodigo() + " -> " + hasta.getCodigo() +
               " | tiempo=" + tiempoViajarDias +
               " | capDisp=" + getCapacidadDisponible() +
               " | cancelado=" + cancelado;
    }
}
