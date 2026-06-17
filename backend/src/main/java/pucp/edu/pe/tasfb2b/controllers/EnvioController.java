package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.services.SeguimientoService;

@RestController
@RequestMapping("/api/envios")
public class EnvioController {

    private final SeguimientoService seguimientoService;

    public EnvioController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    @GetMapping("/{codigo}")
    public ResponseEntity<?> obtenerEnvio(
            @PathVariable String codigo,
            @RequestParam(required = false) Integer idSimulacion
    ) {
        try {
            return ResponseEntity.ok(seguimientoService.obtenerEnvioDetalle(codigo, idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
