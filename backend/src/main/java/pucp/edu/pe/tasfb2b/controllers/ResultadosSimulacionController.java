package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pucp.edu.pe.tasfb2b.services.ResultadosSimulacionService;

@RestController
@RequestMapping("/api/simulaciones")
public class ResultadosSimulacionController {

    private final ResultadosSimulacionService resultadosSimulacionService;

    public ResultadosSimulacionController(ResultadosSimulacionService resultadosSimulacionService) {
        this.resultadosSimulacionService = resultadosSimulacionService;
    }

    @GetMapping("/periodo/{id}")
    public ResponseEntity<?> obtenerResultadoPeriodo(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(resultadosSimulacionService.obtenerResultadoPeriodo(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/colapso/{id}")
    public ResponseEntity<?> obtenerResultadoColapso(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(resultadosSimulacionService.obtenerResultadoColapso(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
