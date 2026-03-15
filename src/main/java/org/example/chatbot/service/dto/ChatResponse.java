package org.example.chatbot.service.dto;

import java.util.List;

public record ChatResponse(String answer, List<SourceSnippet> sources) {
}
