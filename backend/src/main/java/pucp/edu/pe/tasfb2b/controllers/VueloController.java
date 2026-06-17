package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.controllers.dto.CancelarVueloRequest;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

@RestController
@RequestMapping("/api/vuelos")
public class VueloController {

    private final SeguimientoService seguimientoService;

    public VueloController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<?> obtenerVuelo(
            @PathVariable String codigo,
            @RequestParam(required = false) Integer idSimulacion
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.obtenerVueloDetalle(codigo, idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{codigo}/cancelar")
    public ResponseEntity<?> cancelarVuelo(
            @PathVariable String codigo,
            @RequestBody CancelarVueloRequest request
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.cancelarVuelo(codigo, request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
