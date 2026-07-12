package pucp.edu.pe.tasfb2b.services;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import pucp.edu.pe.tasfb2b.entities.EstadoVueloOcurrencia;
import pucp.edu.pe.tasfb2b.entities.Vuelo;
import pucp.edu.pe.tasfb2b.entities.VueloOcurrencia;
import pucp.edu.pe.tasfb2b.repositories.VueloOcurrenciaRepository;
import pucp.edu.pe.tasfb2b.repositories.VueloRepository;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.HashSet;

@Service
public class VueloOcurrenciaService {

    public static final int DIAS_VENTANA_OPERATIVA = 5;
    private static final int MINUTOS_DIA = 24 * 60;

    private final VueloRepository vueloRepository;
    private final VueloOcurrenciaRepository ocurrenciaRepository;

    public VueloOcurrenciaService(
            VueloRepository vueloRepository,
            VueloOcurrenciaRepository ocurrenciaRepository
    ) {
        this.vueloRepository = vueloRepository;
        this.ocurrenciaRepository = ocurrenciaRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void completarVentanaOperativaAlIniciar() {
        completarVentanaOperativa(LocalDate.now(ZoneOffset.UTC));
        actualizarEstadosOperativos();
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "UTC")
    @Transactional
    public void mantenerVentanaOperativa() {
        completarVentanaOperativa(LocalDate.now(ZoneOffset.UTC));
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void actualizarEstadosOperativos() {
        LocalDateTime ahora = LocalDateTime.now(ZoneOffset.UTC);
        List<VueloOcurrencia> ocurrencias = ocurrenciaRepository
                .findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(
                        ahora.toLocalDate().minusDays(1).atStartOfDay(),
                        ahora.toLocalDate().plusDays(DIAS_VENTANA_OPERATIVA).atStartOfDay()
                );
        ocurrencias.forEach(ocurrencia -> actualizarEstadoTemporal(ocurrencia, ahora));
        ocurrenciaRepository.saveAll(ocurrencias);
    }

    @Transactional
    public List<VueloOcurrencia> completarVentanaOperativa(LocalDate fechaInicial) {
        List<VueloOcurrencia> creadas = new ArrayList<>();
        List<Vuelo> plantillas = vueloRepository.findAll();
        LocalDateTime inicio = fechaInicial.atStartOfDay();
        LocalDateTime fin = fechaInicial.plusDays(DIAS_VENTANA_OPERATIVA).atStartOfDay();
        Set<String> existentes = new HashSet<>();
        for (VueloOcurrencia ocurrencia : ocurrenciaRepository
                .findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(inicio, fin)) {
            existentes.add(clave(ocurrencia.getVuelo().getIdVuelo(), ocurrencia.getFechaHoraSalida()));
        }

        for (int dia = 0; dia < DIAS_VENTANA_OPERATIVA; dia++) {
            LocalDate fecha = fechaInicial.plusDays(dia);
            for (Vuelo vuelo : plantillas) {
                LocalDateTime salida = fecha.atStartOfDay().plusMinutes(valor(vuelo.getSalidaUtcMin()));
                if (existentes.contains(clave(vuelo.getIdVuelo(), salida))) {
                    continue;
                }
                creadas.add(crearOcurrencia(vuelo, salida));
            }
        }
        return ocurrenciaRepository.saveAll(creadas);
    }

    public VueloOcurrencia crearOcurrenciaVolatil(Vuelo vuelo, LocalDateTime salida) {
        return crearOcurrencia(vuelo, salida);
    }

    @Transactional
    public VueloOcurrencia obtenerOCrearOperativa(Vuelo vuelo, LocalDateTime salida) {
        Optional<VueloOcurrencia> existente = ocurrenciaRepository
                .findByVuelo_IdVueloAndFechaHoraSalida(vuelo.getIdVuelo(), salida);
        return existente.orElseGet(() -> ocurrenciaRepository.save(crearOcurrencia(vuelo, salida)));
    }

    @Transactional(readOnly = true)
    public Optional<VueloOcurrencia> buscarOperativa(Integer idVuelo, LocalDateTime salida) {
        return ocurrenciaRepository.findByVuelo_IdVueloAndFechaHoraSalida(idVuelo, salida);
    }

    @Transactional
    public void guardarTodas(List<VueloOcurrencia> ocurrencias) {
        ocurrenciaRepository.saveAll(ocurrencias);
    }

    @Transactional
    public VueloOcurrencia cancelarOperativa(Vuelo vuelo, LocalDateTime salida) {
        VueloOcurrencia ocurrencia = obtenerOCrearOperativa(vuelo, salida);
        ocurrencia.setEstado(EstadoVueloOcurrencia.CANCELADO);
        return ocurrenciaRepository.save(ocurrencia);
    }

    public List<VueloOcurrencia> crearOcurrenciasVolatiles(
            List<Vuelo> plantillas,
            LocalDateTime inicio,
            LocalDateTime fin
    ) {
        List<VueloOcurrencia> ocurrencias = new ArrayList<>();
        LocalDate primerDia = inicio.toLocalDate();
        LocalDate ultimoDia = fin.toLocalDate();

        for (LocalDate fecha = primerDia; !fecha.isAfter(ultimoDia); fecha = fecha.plusDays(1)) {
            for (Vuelo vuelo : plantillas) {
                LocalDateTime salida = fecha.atStartOfDay().plusMinutes(valor(vuelo.getSalidaUtcMin()));
                if (!salida.isBefore(inicio) && salida.isBefore(fin)) {
                    ocurrencias.add(crearOcurrencia(vuelo, salida));
                }
            }
        }
        return ocurrencias;
    }

    @Transactional(readOnly = true)
    public List<VueloOcurrencia> listarOperativas(LocalDateTime desde, LocalDateTime hasta) {
        List<VueloOcurrencia> ocurrencias = ocurrenciaRepository
                .findByFechaHoraSalidaGreaterThanEqualAndFechaHoraSalidaLessThan(desde, hasta);
        LocalDateTime referencia = LocalDateTime.now(ZoneOffset.UTC);
        ocurrencias.forEach(ocurrencia -> actualizarEstadoTemporal(ocurrencia, referencia));
        return ocurrencias;
    }

    public void actualizarEstadoTemporal(VueloOcurrencia ocurrencia, LocalDateTime referencia) {
        if (ocurrencia.getEstado() == EstadoVueloOcurrencia.CANCELADO) {
            return;
        }
        if (referencia.isBefore(ocurrencia.getFechaHoraSalida())) {
            ocurrencia.setEstado(EstadoVueloOcurrencia.PROGRAMADO);
        } else if (referencia.isBefore(ocurrencia.getFechaHoraLlegada())) {
            ocurrencia.setEstado(EstadoVueloOcurrencia.EN_VUELO);
        } else {
            ocurrencia.setEstado(EstadoVueloOcurrencia.COMPLETADO);
        }
    }

    private VueloOcurrencia crearOcurrencia(Vuelo vuelo, LocalDateTime salida) {
        int salidaBase = valor(vuelo.getSalidaUtcMin());
        int llegadaBase = valor(vuelo.getLlegadaUtcMin());
        while (llegadaBase <= salidaBase) {
            llegadaBase += MINUTOS_DIA;
        }
        long duracionMinutos = llegadaBase - salidaBase;
        if (vuelo.getTiempoViajarDias() != null && vuelo.getTiempoViajarDias() > 0) {
            duracionMinutos = Math.max(1, Math.round(vuelo.getTiempoViajarDias() * MINUTOS_DIA));
        }
        return new VueloOcurrencia(
                vuelo,
                salida,
                salida.plus(Duration.ofMinutes(duracionMinutos)),
                vuelo.getCapacidad()
        );
    }

    private int valor(Integer valor) {
        return valor != null ? valor : 0;
    }

    private String clave(Integer idVuelo, LocalDateTime salida) {
        return idVuelo + "@" + salida;
    }
}
