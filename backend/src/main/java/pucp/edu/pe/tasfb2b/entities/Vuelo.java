package pucp.edu.pe.tasfb2b.entities;

public class Vuelo {
    private final Aeropuerto desde;
    private final Aeropuerto hasta;
    private final double tiempoViajarDias;
    private final int capacidad;
    private int capacidadUsada;
    private boolean cancelado;

    private final int salidaUtcMin;
    private final int llegadaUtcMin;

    public Vuelo(Aeropuerto desde, Aeropuerto hasta, double tiempoViajarDias, int capacidad,
                 int salidaUtcMin, int llegadaUtcMin) {
        this.desde = desde;
        this.hasta = hasta;
        this.tiempoViajarDias = tiempoViajarDias;
        this.capacidad = capacidad;
        this.capacidadUsada = 0;
        this.cancelado = false;
        this.salidaUtcMin = salidaUtcMin;
        this.llegadaUtcMin = llegadaUtcMin;
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

    public int getSalidaUtcMin() {
        return salidaUtcMin;
    }

    public int getLlegadaUtcMin() {
        return llegadaUtcMin;
    }

    @Override
    public String toString() {
        return desde.getCodigo() + " -> " + hasta.getCodigo() +
               " | tiempo=" + tiempoViajarDias +
               " | capDisp=" + getCapacidadDisponible() +
               " | salidaUTC=" + salidaUtcMin +
               " | llegadaUTC=" + llegadaUtcMin +
               " | cancelado=" + cancelado;
    }
}