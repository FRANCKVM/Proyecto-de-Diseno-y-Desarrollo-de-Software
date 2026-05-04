package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import pucp.edu.pe.tasfb2b.services.SimulacionService;

@RestController
@RequestMapping("/api/simulacion")
public class SimulacionController {

    private final SimulacionService simulacionService;

    public SimulacionController(SimulacionService simulacionService) {
        this.simulacionService = simulacionService;
    }

    @GetMapping("/periodo")
    public ResponseEntity<SimulacionService.ResultadoSimulacion> simularPeriodo() {
        try {
            SimulacionService.ResultadoSimulacion resultado =
                    simulacionService.simularPeriodoPorDefecto();

            return ResponseEntity.ok(resultado);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}