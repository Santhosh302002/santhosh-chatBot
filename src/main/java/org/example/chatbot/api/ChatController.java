package org.example.chatbot.api;

import jakarta.validation.Valid;
import org.example.chatbot.service.RagService;
import org.example.chatbot.service.dto.ChatRequest;
import org.example.chatbot.service.dto.ChatResponse;
import org.example.chatbot.service.dto.IngestRequest;
import org.example.chatbot.service.dto.IngestResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final RagService ragService;
    private final String adminToken;

    public ChatController(RagService ragService, @Value("${app.admin.token:}") String adminToken) {
        this.ragService = ragService;
        this.adminToken = adminToken;
    }

    @PostMapping("/documents")
    public IngestResponse ingest(
            @RequestHeader(value = "X-Admin-Token", required = false) String providedAdminToken,
            @Valid @RequestBody IngestRequest request) {
        validateAdminToken(providedAdminToken);
        return ragService.ingest(request);
    }

    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return ragService.answer(request);
    }

    private void validateAdminToken(String providedAdminToken) {
        if (adminToken == null || adminToken.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Admin ingestion token is not configured");
        }

        if (!adminToken.equals(providedAdminToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin token");
        }
    }
}
