package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import pucp.edu.pe.tasfb2b.controllers.dto.AeropuertoResponse;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.repositories.AsignacionEnvioRepository;
import pucp.edu.pe.tasfb2b.services.OperacionesService;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/aeropuertos")
public class AeropuertoController {

    private final AeropuertoRepository aeropuertoRepository;
    private final AsignacionEnvioRepository asignacionEnvioRepository;
    private final OperacionesService operacionesService;
    private final SeguimientoService seguimientoService;

    public AeropuertoController(
            AeropuertoRepository aeropuertoRepository,
            AsignacionEnvioRepository asignacionEnvioRepository,
            OperacionesService operacionesService,
            SeguimientoService seguimientoService
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.asignacionEnvioRepository = asignacionEnvioRepository;
        this.operacionesService = operacionesService;
        this.seguimientoService = seguimientoService;
    }

    @GetMapping
    public ResponseEntity<List<AeropuertoResponse>> listarAeropuertos() {
        operacionesService.liberarCapacidadOrigenPorSalidasOperacion();
        Map<String, Integer> bolsasAsignadasPorOrigen = obtenerBolsasAsignadasPorOrigen();
        return ResponseEntity.ok(aeropuertoRepository.findAll().stream()
                .map(aeropuerto -> mapearAeropuerto(aeropuerto, bolsasAsignadasPorOrigen))
                .toList());
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<?> obtenerAeropuerto(@PathVariable String codigo) {
        operacionesService.liberarCapacidadOrigenPorSalidasOperacion();
        Map<String, Integer> bolsasAsignadasPorOrigen = obtenerBolsasAsignadasPorOrigen();
        return aeropuertoRepository.findByCodigo(codigo)
                .<ResponseEntity<?>>map(aeropuerto -> ResponseEntity.ok(
                        mapearAeropuerto(aeropuerto, bolsasAsignadasPorOrigen)
                ))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{codigo}/vuelos")
    public ResponseEntity<?> obtenerVuelosAeropuerto(
            @PathVariable String codigo,
            @RequestParam(required = false) Integer idSimulacion,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha
    ) {
        try {
            return ResponseEntity.ok(
                    seguimientoService.listarVuelosPorAeropuerto(codigo, idSimulacion, fecha)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private Map<String, Integer> obtenerBolsasAsignadasPorOrigen() {
        return asignacionEnvioRepository.sumarBolsasAsignadasPorOrigen().stream()
                .collect(Collectors.toMap(
                        fila -> String.valueOf(fila[0]),
                        fila -> fila[1] instanceof Number numero ? numero.intValue() : 0
                ));
    }

    private AeropuertoResponse mapearAeropuerto(
            Aeropuerto aeropuerto,
            Map<String, Integer> bolsasAsignadasPorOrigen
    ) {
        int capacidadDisponible = aeropuerto.getCapacidad() != null
                ? aeropuerto.getCapacidad()
                : 0;
        int bolsasAsignadas = bolsasAsignadasPorOrigen.getOrDefault(
                aeropuerto.getCodigo(),
                0
        );
        int capacidadTotal = capacidadDisponible + bolsasAsignadas;

        return new AeropuertoResponse(
                aeropuerto.getCodigo(),
                aeropuerto.getCiudad(),
                aeropuerto.getRegion(),
                aeropuerto.getPais(),
                aeropuerto.getAlias(),
                aeropuerto.getDesplazamientoGMT(),
                capacidadTotal,
                capacidadDisponible,
                aeropuerto.getLatitud(),
                aeropuerto.getLongitud()
        );
    }
}
