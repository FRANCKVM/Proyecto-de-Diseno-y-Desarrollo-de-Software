package pucp.edu.pe.tasfb2b.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import pucp.edu.pe.tasfb2b.controllers.dto.RealtimeEventResponse;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SimulationSseService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SimulationSseService.class);
    private static final long EMITTER_TIMEOUT_MS = 30L * 60L * 1000L;

    private final Map<Integer, CopyOnWriteArrayList<SseEmitter>> emittersBySimulation =
            new ConcurrentHashMap<>();

    public SseEmitter subscribe(Integer idSimulacion) {
        if (idSimulacion == null) {
            throw new IllegalArgumentException("El id de simulacion es obligatorio.");
        }

        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        emittersBySimulation
                .computeIfAbsent(idSimulacion, ignored -> new CopyOnWriteArrayList<>())
                .add(emitter);

        emitter.onCompletion(() -> removeEmitter(idSimulacion, emitter));
        emitter.onTimeout(() -> removeEmitter(idSimulacion, emitter));
        emitter.onError(error -> removeEmitter(idSimulacion, emitter));

        sendToEmitter(
                idSimulacion,
                emitter,
                new RealtimeEventResponse(
                        "connected",
                        idSimulacion,
                        Map.of("connected", true),
                        Instant.now()
                )
        );

        return emitter;
    }

    public void publish(Integer idSimulacion, String type, Object payload) {
        if (idSimulacion == null || type == null || type.isBlank()) {
            return;
        }

        RealtimeEventResponse event = new RealtimeEventResponse(
                type,
                idSimulacion,
                payload != null ? payload : Map.of(),
                Instant.now()
        );

        List<SseEmitter> emitters = emittersBySimulation.get(idSimulacion);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            sendToEmitter(idSimulacion, emitter, event);
        }
    }

    public boolean hasSubscribers(Integer idSimulacion) {
        if (idSimulacion == null) {
            return false;
        }

        List<SseEmitter> emitters = emittersBySimulation.get(idSimulacion);
        return emitters != null && !emitters.isEmpty();
    }

    @Scheduled(fixedRate = 15000)
    public void sendHeartbeat() {
        for (Integer idSimulacion : emittersBySimulation.keySet()) {
            publish(
                    idSimulacion,
                    "heartbeat",
                    Map.of("alive", true)
            );
        }
    }

    private void sendToEmitter(
            Integer idSimulacion,
            SseEmitter emitter,
            RealtimeEventResponse event
    ) {
        try {
            emitter.send(SseEmitter.event()
                    .id(String.valueOf(event.timestamp().toEpochMilli()))
                    .name(event.type())
                    .data(event));
        } catch (IOException | IllegalStateException error) {
            LOGGER.debug("SSE emitter cerrado para simulacion {}.", idSimulacion, error);
            removeEmitter(idSimulacion, emitter);
        }
    }

    private void removeEmitter(Integer idSimulacion, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = emittersBySimulation.get(idSimulacion);
        if (emitters == null) {
            return;
        }

        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersBySimulation.remove(idSimulacion);
        }
    }
}
