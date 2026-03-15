package org.example.chatbot.service.dto;

import jakarta.validation.constraints.NotBlank;

public record IngestRequest(
        @NotBlank(message = "documentId is required")
        String documentId,
        @NotBlank(message = "title is required")
        String title,
        @NotBlank(message = "text is required")
        String text
) {
}
