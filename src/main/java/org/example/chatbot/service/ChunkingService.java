package org.example.chatbot.service;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ChunkingService {

    private static final int MAX_CHUNK_LENGTH = 800;
    private static final int CHUNK_OVERLAP = 120;

    public List<String> split(String text) {
        String normalized = text == null ? "" : text.trim().replace("\r\n", "\n");
        if (normalized.isBlank()) {
            return List.of();
        }

        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < normalized.length()) {
            int end = Math.min(start + MAX_CHUNK_LENGTH, normalized.length());
            if (end < normalized.length()) {
                int breakPoint = findBreakPoint(normalized, start, end);
                if (breakPoint > start) {
                    end = breakPoint;
                }
            }

            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }

            if (end == normalized.length()) {
                break;
            }
            start = Math.max(end - CHUNK_OVERLAP, start + 1);
        }
        return chunks;
    }

    private int findBreakPoint(String text, int start, int end) {
        int paragraph = text.lastIndexOf("\n\n", end);
        if (paragraph > start) {
            return paragraph;
        }

        int sentence = Math.max(text.lastIndexOf(". ", end), text.lastIndexOf("\n", end));
        if (sentence > start) {
            return sentence + 1;
        }

        int whitespace = text.lastIndexOf(' ', end);
        if (whitespace > start) {
            return whitespace;
        }
        return end;
    }
}
