package pucp.edu.pe.tasfb2b.services;

public class EstadoSimulacion {

    private final Integer idSimulacion;
    private final boolean activa;
    private final boolean procesandoBloque;

    private final Integer k;
    private final Integer saMinutos;
    private final Integer scMinutos;
    private final Integer punteroConsumoMinutos;
    private final Integer ultimoMinutoSimulacion;

    private final int indiceSiguienteSolicitud;
    private final int totalSolicitudesCargadas;
    private final int bloquesProcesados;

    private final int totalSolicitudes;
    private final int resueltas;
    private final int noResueltas;
    private final int noResueltasPorAlmacenOrigen;
    private final int noResueltasPorRutaVueloPlazo;

    private final int rutasDirectas;
    private final int rutasConParada;
    private final int totalVuelosUsados;
    private final int totalEscalas;

    private final double promedioVuelos;
    private final double promedioEscalas;
    private final double porcentajeDirectas;
    private final double porcentajeConParada;

    private final double costoPromedioRutas;
    private final double porcentajeResueltas;
    private final double tiempoPlanificacionTotalSeg;
    private final double tiempoPromedioPorSolicitudMs;
    private final double fitnessGlobal;

    public EstadoSimulacion(
            Integer idSimulacion,
            boolean activa,
            boolean procesandoBloque,
            Integer k,
            Integer saMinutos,
            Integer scMinutos,
            Integer punteroConsumoMinutos,
            Integer ultimoMinutoSimulacion,
            int indiceSiguienteSolicitud,
            int totalSolicitudesCargadas,
            int bloquesProcesados,
            int totalSolicitudes,
            int resueltas,
            int noResueltas,
            int noResueltasPorAlmacenOrigen,
            int noResueltasPorRutaVueloPlazo,
            int rutasDirectas,
            int rutasConParada,
            int totalVuelosUsados,
            int totalEscalas,
            double promedioVuelos,
            double promedioEscalas,
            double porcentajeDirectas,
            double porcentajeConParada,
            double costoPromedioRutas,
            double porcentajeResueltas,
            double tiempoPlanificacionTotalSeg,
            double tiempoPromedioPorSolicitudMs,
            double fitnessGlobal
    ) {
        this.idSimulacion = idSimulacion;
        this.activa = activa;
        this.procesandoBloque = procesandoBloque;
        this.k = k;
        this.saMinutos = saMinutos;
        this.scMinutos = scMinutos;
        this.punteroConsumoMinutos = punteroConsumoMinutos;
        this.ultimoMinutoSimulacion = ultimoMinutoSimulacion;
        this.indiceSiguienteSolicitud = indiceSiguienteSolicitud;
        this.totalSolicitudesCargadas = totalSolicitudesCargadas;
        this.bloquesProcesados = bloquesProcesados;
        this.totalSolicitudes = totalSolicitudes;
        this.resueltas = resueltas;
        this.noResueltas = noResueltas;
        this.noResueltasPorAlmacenOrigen = noResueltasPorAlmacenOrigen;
        this.noResueltasPorRutaVueloPlazo = noResueltasPorRutaVueloPlazo;
        this.rutasDirectas = rutasDirectas;
        this.rutasConParada = rutasConParada;
        this.totalVuelosUsados = totalVuelosUsados;
        this.totalEscalas = totalEscalas;
        this.promedioVuelos = promedioVuelos;
        this.promedioEscalas = promedioEscalas;
        this.porcentajeDirectas = porcentajeDirectas;
        this.porcentajeConParada = porcentajeConParada;
        this.costoPromedioRutas = costoPromedioRutas;
        this.porcentajeResueltas = porcentajeResueltas;
        this.tiempoPlanificacionTotalSeg = tiempoPlanificacionTotalSeg;
        this.tiempoPromedioPorSolicitudMs = tiempoPromedioPorSolicitudMs;
        this.fitnessGlobal = fitnessGlobal;
    }

    public Integer getIdSimulacion() {
        return idSimulacion;
    }

    public boolean isActiva() {
        return activa;
    }

    public boolean isProcesandoBloque() {
        return procesandoBloque;
    }

    public Integer getK() {
        return k;
    }

    public Integer getSaMinutos() {
        return saMinutos;
    }

    public Integer getScMinutos() {
        return scMinutos;
    }

    public Integer getPunteroConsumoMinutos() {
        return punteroConsumoMinutos;
    }

    public Integer getUltimoMinutoSimulacion() {
        return ultimoMinutoSimulacion;
    }

    public int getIndiceSiguienteSolicitud() {
        return indiceSiguienteSolicitud;
    }

    public int getTotalSolicitudesCargadas() {
        return totalSolicitudesCargadas;
    }

    public int getBloquesProcesados() {
        return bloquesProcesados;
    }

    public int getTotalSolicitudes() {
        return totalSolicitudes;
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

    public double getPromedioVuelos() {
        return promedioVuelos;
    }

    public double getPromedioEscalas() {
        return promedioEscalas;
    }

    public double getPorcentajeDirectas() {
        return porcentajeDirectas;
    }

    public double getPorcentajeConParada() {
        return porcentajeConParada;
    }

    public double getCostoPromedioRutas() {
        return costoPromedioRutas;
    }

    public double getPorcentajeResueltas() {
        return porcentajeResueltas;
    }

    public double getTiempoPlanificacionTotalSeg() {
        return tiempoPlanificacionTotalSeg;
    }

    public double getTiempoPromedioPorSolicitudMs() {
        return tiempoPromedioPorSolicitudMs;
    }

    public double getFitnessGlobal() {
        return fitnessGlobal;
    }
}
