package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

@RestController
@RequestMapping("/api/vuelos")
public class VueloController {

    private final SeguimientoService seguimientoService;

    public VueloController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<?> obtenerVuelo(@PathVariable String codigo) {
        try {
            return ResponseEntity.ok(seguimientoService.obtenerVueloDetalle(codigo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
