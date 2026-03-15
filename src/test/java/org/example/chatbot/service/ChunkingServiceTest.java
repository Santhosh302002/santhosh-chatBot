package org.example.chatbot.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChunkingServiceTest {

    private final ChunkingService chunkingService = new ChunkingService();

    @Test
    void splitReturnsMultipleChunksForLongText() {
        String text = "Spring AI makes it easier to build RAG pipelines. ".repeat(80);

        List<String> chunks = chunkingService.split(text);

        assertTrue(chunks.size() > 1);
        assertFalse(chunks.stream().anyMatch(String::isBlank));
    }
}
