package pucp.edu.pe.tasfb2b.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import pucp.edu.pe.tasfb2b.controllers.dto.RealtimeEventResponse;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class OperationSseService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OperationSseService.class);
    private static final long EMITTER_TIMEOUT_MS = 30L * 60L * 1000L;

    private final CopyOnWriteArrayList<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        emitters.add(emitter);

        emitter.onCompletion(() -> removeEmitter(emitter));
        emitter.onTimeout(() -> removeEmitter(emitter));
        emitter.onError(error -> removeEmitter(emitter));

        sendToEmitter(
                emitter,
                new RealtimeEventResponse(
                        "connected",
                        null,
                        Map.of("connected", true),
                        Instant.now()
                )
        );

        return emitter;
    }

    public void publish(String type, Object payload) {
        if (type == null || type.isBlank() || emitters.isEmpty()) {
            return;
        }

        RealtimeEventResponse event = new RealtimeEventResponse(
                type,
                null,
                payload != null ? payload : Map.of(),
                Instant.now()
        );

        for (SseEmitter emitter : emitters) {
            sendToEmitter(emitter, event);
        }
    }

    public boolean hasSubscribers() {
        return !emitters.isEmpty();
    }

    @Scheduled(fixedRate = 15000)
    public void sendHeartbeat() {
        publish("heartbeat", Map.of("alive", true));
    }

    private void sendToEmitter(SseEmitter emitter, RealtimeEventResponse event) {
        try {
            emitter.send(SseEmitter.event()
                    .id(String.valueOf(event.timestamp().toEpochMilli()))
                    .name(event.type())
                    .data(event));
        } catch (IOException | IllegalStateException error) {
            LOGGER.debug("SSE emitter cerrado para operacion.", error);
            removeEmitter(emitter);
        }
    }

    private void removeEmitter(SseEmitter emitter) {
        emitters.remove(emitter);
    }
}
