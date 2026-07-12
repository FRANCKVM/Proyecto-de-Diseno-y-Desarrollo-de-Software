package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;
import pucp.edu.pe.tasfb2b.controllers.dto.CancelarVueloRequest;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/vuelos")
public class VueloController {

    private final SeguimientoService seguimientoService;

    public VueloController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    @GetMapping("/ocurrencias/{idOcurrencia}")
    public ResponseEntity<?> obtenerOcurrencia(
            @PathVariable Long idOcurrencia,
            @RequestParam(required = false) Integer idSimulacion
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.obtenerOcurrenciaDetalle(idOcurrencia, idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/ocurrencias")
    public ResponseEntity<?> listarOcurrencias(
            @RequestParam(required = false) Integer idSimulacion,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.listarOcurrencias(idSimulacion, fecha));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/ocurrencias/{idOcurrencia}/cancelar")
    public ResponseEntity<?> cancelarVuelo(
            @PathVariable Long idOcurrencia,
            @RequestBody CancelarVueloRequest request
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.cancelarOcurrencia(idOcurrencia, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
