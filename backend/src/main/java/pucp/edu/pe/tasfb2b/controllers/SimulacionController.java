package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pucp.edu.pe.tasfb2b.controllers.dto.InicioSimulacionRequest;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.services.EstadoSimulacion;
import pucp.edu.pe.tasfb2b.services.OperacionesService;
import pucp.edu.pe.tasfb2b.services.SimulacionService;

import java.util.List;

@RestController
@RequestMapping("/api/simulacion")
public class SimulacionController {

    private final SimulacionService simulacionService;
    private final OperacionesService operacionesService;

    public SimulacionController(
            SimulacionService simulacionService,
            OperacionesService operacionesService
    ) {
        this.simulacionService = simulacionService;
        this.operacionesService = operacionesService;
    }

    @PostMapping("/iniciar")
    public ResponseEntity<?> iniciarSimulacion(
            @RequestBody InicioSimulacionRequest request
    ) {
        try {
            EstadoSimulacion estado = simulacionService.iniciarSimulacion(
                    request.k(),
                    request.fechaInicio(),
                    request.horaInicio(),
                    request.duracionDias()
            );
            return ResponseEntity.ok(estado);

        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body("Error al iniciar la simulacion");
        }
    }

    @GetMapping("/estado")
    public ResponseEntity<EstadoSimulacion> obtenerEstado() {
        return ResponseEntity.ok(simulacionService.obtenerEstado());
    }

    @GetMapping("/{idSimulacion}/estado")
    public ResponseEntity<?> obtenerEstado(@PathVariable Integer idSimulacion) {
        try {
            return ResponseEntity.ok(simulacionService.obtenerEstado(idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{idSimulacion}/envios")
    public ResponseEntity<?> obtenerEnvios(@PathVariable Integer idSimulacion) {
        try {
            return ResponseEntity.ok(simulacionService.obtenerEnviosSimulacion(idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{idSimulacion}/mapa")
    public ResponseEntity<?> obtenerMapa(@PathVariable Integer idSimulacion) {
        try {
            return ResponseEntity.ok(simulacionService.obtenerMapaSimulacion(idSimulacion));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/planificar-bloque")
    public ResponseEntity<?> planificarBloque(@RequestBody List<SolicitudEnvio> solicitudesEntrantes) {
        try {
            List<SolicitudEnvio> resultados = operacionesService.procesarBloqueReal(solicitudesEntrantes);
            return ResponseEntity.ok(resultados);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body("Error al planificar el bloque de envios");
        }
    }

    @PostMapping("/detener")
    public ResponseEntity<String> detenerSimulacion() {
        simulacionService.detenerSimulacion();
        return ResponseEntity.ok("Simulacion detenida");
    }
}
