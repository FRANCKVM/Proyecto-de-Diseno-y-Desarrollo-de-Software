package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.controllers.dto.RegistrarOperacionEnvioRequest;
import pucp.edu.pe.tasfb2b.services.OperacionesService;

@RestController
@RequestMapping("/api/operacion")
public class OperacionController {

    private final OperacionesService operacionesService;

    public OperacionController(OperacionesService operacionesService) {
        this.operacionesService = operacionesService;
    }

    @GetMapping("/estado")
    public ResponseEntity<?> obtenerEstado() {
        return ResponseEntity.ok(operacionesService.obtenerEstadoOperacion());
    }

    @GetMapping("/envios")
    public ResponseEntity<?> obtenerEnvios() {
        return ResponseEntity.ok(operacionesService.obtenerEnviosOperacion());
    }

    @PostMapping("/envios")
    public ResponseEntity<?> registrarEnvio(@RequestBody RegistrarOperacionEnvioRequest request) {
        try {
            return ResponseEntity.ok(operacionesService.registrarEnvioOperacion(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/mapa")
    public ResponseEntity<?> obtenerMapa() {
        return ResponseEntity.ok(operacionesService.obtenerMapaOperacion());
    }
}
