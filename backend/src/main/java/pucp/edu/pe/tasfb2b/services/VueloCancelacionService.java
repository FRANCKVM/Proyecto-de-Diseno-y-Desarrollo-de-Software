package pucp.edu.pe.tasfb2b.services;

import org.springframework.stereotype.Service;
import pucp.edu.pe.tasfb2b.entities.Vuelo;

import java.time.LocalDateTime;
import java.util.Random;

@Service
public class VueloCancelacionService {

    public static final double PROBABILIDAD_CANCELACION = 0.10;
    public static final long SEMILLA_CANCELACION = 42L;
    public static final int MINUTOS_AVISO_MIN = 60;
    public static final int MINUTOS_AVISO_MAX = 180;
    public static final int MINUTOS_DIA = 24 * 60;

    public boolean debeCancelar(Vuelo vuelo, long claveSalida) {
        if (vuelo == null || vuelo.getIdVuelo() == null) {
            return false;
        }

        return crearRandom(vuelo.getIdVuelo(), claveSalida).nextDouble() < PROBABILIDAD_CANCELACION;
    }

    public int calcularAnticipacionMinutos(Vuelo vuelo, long claveSalida) {
        Random random = crearRandom(vuelo.getIdVuelo(), claveSalida);
        random.nextDouble();
        return MINUTOS_AVISO_MIN + random.nextInt(MINUTOS_AVISO_MAX - MINUTOS_AVISO_MIN + 1);
    }

    public int calcularMinutoCancelacionSimulada(Vuelo vuelo, int salidaMinuto) {
        return salidaMinuto - calcularAnticipacionMinutos(vuelo, salidaMinuto);
    }

    public LocalDateTime calcularFechaHoraCancelacion(Vuelo vuelo, LocalDateTime fechaHoraSalida) {
        return fechaHoraSalida.minusMinutes(calcularAnticipacionMinutos(
                vuelo,
                convertirAClaveMinutos(fechaHoraSalida)
        ));
    }

    public long convertirAClaveMinutos(LocalDateTime fechaHora) {
        return fechaHora.toLocalDate().toEpochDay() * MINUTOS_DIA
                + fechaHora.toLocalTime().getHour() * 60L
                + fechaHora.toLocalTime().getMinute();
    }

    public LocalDateTime construirFechaHoraSalida(LocalDateTime fechaBase, Vuelo vuelo) {
        int salida = vuelo.getSalidaUtcMin() != null ? vuelo.getSalidaUtcMin() : 0;
        return fechaBase.toLocalDate().atStartOfDay().plusMinutes(salida);
    }

    private Random crearRandom(Integer idVuelo, long claveSalida) {
        long seed = SEMILLA_CANCELACION;
        seed = seed * 31 + idVuelo;
        seed = seed * 31 + claveSalida;
        return new Random(seed);
    }
}
