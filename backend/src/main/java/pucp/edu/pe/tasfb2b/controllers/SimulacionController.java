package pucp.edu.pe.tasfb2b.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import pucp.edu.pe.tasfb2b.controllers.dto.InicioSimulacionRequest;
import pucp.edu.pe.tasfb2b.entities.SolicitudEnvio;
import pucp.edu.pe.tasfb2b.services.EstadoSimulacion;
import pucp.edu.pe.tasfb2b.services.OperacionesService;
import pucp.edu.pe.tasfb2b.services.SimulacionService;
import pucp.edu.pe.tasfb2b.services.SimulationSseService;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/simulacion")
public class SimulacionController {

    private final SimulacionService simulacionService;
    private final OperacionesService operacionesService;
    private final SimulationSseService simulationSseService;

    public SimulacionController(
            SimulacionService simulacionService,
            OperacionesService operacionesService,
            SimulationSseService simulationSseService
    ) {
        this.simulacionService = simulacionService;
        this.operacionesService = operacionesService;
        this.simulationSseService = simulationSseService;
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

    @GetMapping("/{idSimulacion}/envios/pagina")
    public ResponseEntity<?> obtenerEnviosPaginados(
            @PathVariable Integer idSimulacion,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "80") int size,
            @RequestParam(required = false) String codigo,
            @RequestParam(defaultValue = "todos") String estado,
            @RequestParam(defaultValue = "todos") String aeropuerto,
            @RequestParam(defaultValue = "todos") String direccion,
            @RequestParam(required = false) Integer horasEntregados
    ) {
        try {
            return ResponseEntity.ok(simulacionService.obtenerEnviosSimulacionPaginados(
                    idSimulacion,
                    page,
                    size,
                    codigo,
                    estado,
                    aeropuerto,
                    direccion,
                    horasEntregados
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{idSimulacion}/maletas")
    public ResponseEntity<?> obtenerMaletasPaginadas(
            @PathVariable Integer idSimulacion,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(required = false) String codigo,
            @RequestParam(defaultValue = "todos") String estado,
            @RequestParam(defaultValue = "todos") String aeropuerto,
            @RequestParam(required = false) Integer horasEntregados
    ) {
        try {
            return ResponseEntity.ok(simulacionService.obtenerMaletasSimulacionPaginadas(
                    idSimulacion,
                    page,
                    size,
                    codigo,
                    estado,
                    aeropuerto,
                    horasEntregados
            ));
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

    @GetMapping(
            value = "/{idSimulacion}/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter stream(@PathVariable Integer idSimulacion) {
        simulacionService.obtenerEstado(idSimulacion);
        return simulationSseService.subscribe(idSimulacion);
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
