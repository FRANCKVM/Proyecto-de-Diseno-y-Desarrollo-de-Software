package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import pucp.edu.pe.tasfb2b.entities.Aeropuerto;
import pucp.edu.pe.tasfb2b.repositories.AeropuertoRepository;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/aeropuertos")
public class AeropuertoController {

    private final AeropuertoRepository aeropuertoRepository;
    private final SeguimientoService seguimientoService;

    public AeropuertoController(
            AeropuertoRepository aeropuertoRepository,
            SeguimientoService seguimientoService
    ) {
        this.aeropuertoRepository = aeropuertoRepository;
        this.seguimientoService = seguimientoService;
    }

    @GetMapping
    public ResponseEntity<List<Aeropuerto>> listarAeropuertos() {
        return ResponseEntity.ok(aeropuertoRepository.findAll());
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<?> obtenerAeropuerto(@PathVariable String codigo) {
        return aeropuertoRepository.findByCodigo(codigo)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
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
}
