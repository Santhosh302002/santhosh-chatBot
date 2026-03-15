package org.example.chatbot.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

import org.example.chatbot.service.dto.ChatRequest;
import org.example.chatbot.service.dto.ChatResponse;
import org.example.chatbot.service.dto.IngestRequest;
import org.example.chatbot.service.dto.IngestResponse;
import org.example.chatbot.service.dto.SourceSnippet;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

@Service
public class RagService {

    private static final String USER_PROMPT = """
            Context:
            {context}

            Question:
            {question}
            """;

    private final VectorStore vectorStore;
    private final ChatClient chatClient;
    private final ChunkingService chunkingService;

    @Value("${app.persona.enabled:true}")
    private boolean personaEnabled;

    @Value("${app.persona.name:Santhosh}")
    private String personaName;

    @Value("${app.persona.tone:friendly, practical, concise}")
    private String personaTone;

    @Value("${app.persona.details:}")
    private String personaDetails;

    public RagService(VectorStore vectorStore, ChatClient.Builder chatClientBuilder, ChunkingService chunkingService) {
        this.vectorStore = vectorStore;
        this.chatClient = chatClientBuilder.build();
        this.chunkingService = chunkingService;
    }

    public IngestResponse ingest(IngestRequest request) {
        List<String> chunks = chunkingService.split(request.text());
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("Document text must contain at least one non-blank chunk");
        }

        List<Document> documents = createDocuments(request, chunks);
        vectorStore.add(documents);
        return new IngestResponse(request.documentId(), documents.size());
    }

    public ChatResponse answer(ChatRequest request) {
        int topK = request.topK() == null ? 4 : request.topK();
        List<Document> matches = vectorStore.similaritySearch(SearchRequest.builder()
                .query(request.question())
                .topK(topK)
                .build());

        String context = matches.isEmpty()
                ? "No relevant context was found in the vector database."
                : formatContext(matches);

        String answer = chatClient.prompt()
                .system(buildSystemPrompt())
                .user(user -> user.text(USER_PROMPT)
                        .param("context", context)
                        .param("question", request.question()))
                .call()
                .content();

        List<SourceSnippet> sources = matches.stream()
                .map(this::toSourceSnippet)
                .toList();

        return new ChatResponse(answer == null ? "" : answer, sources);
    }

    private List<Document> createDocuments(IngestRequest request, List<String> chunks) {
        return java.util.stream.IntStream.range(0, chunks.size())
                .mapToObj(index -> buildDocument(request, chunks.get(index), index))
                .toList();
    }

    private Document buildDocument(IngestRequest request, String chunk, int chunkIndex) {
        String sourceId = request.documentId() + "-chunk-" + chunkIndex;
        String vectorId = UUID.nameUUIDFromBytes(sourceId.getBytes(StandardCharsets.UTF_8)).toString();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("documentId", request.documentId());
        metadata.put("sourceId", sourceId);
        metadata.put("title", request.title());
        metadata.put("chunkIndex", chunkIndex);
        return Document.builder()
                .id(vectorId)
                .text(chunk)
                .metadata(metadata)
                .build();
    }

    private String formatContext(List<Document> matches) {
        StringBuilder builder = new StringBuilder();
        for (Document match : matches) {
            builder.append("Source ID: ")
                    .append(match.getMetadata().getOrDefault("sourceId", match.getId()))
                    .append('\n');
            builder.append("Title: ")
                    .append(match.getMetadata().getOrDefault("title", "Untitled"))
                    .append('\n');
            builder.append("Content: ")
                    .append(match.getText())
                    .append("\n\n");
        }
        return builder.toString().trim();
    }

    private SourceSnippet toSourceSnippet(Document document) {
        String sourceId = String.valueOf(document.getMetadata().getOrDefault("sourceId", document.getId()));
        String title = String.valueOf(document.getMetadata().getOrDefault("title", "Untitled"));
        String content = document.getText();
        String preview = content.length() <= 220 ? content : content.substring(0, 220) + "...";
        return new SourceSnippet(sourceId, title, preview);
    }

    private String buildSystemPrompt() {
        if (!personaEnabled) {
            return """
                    You are a retrieval-augmented assistant.
                    Follow this strict policy:
                    1) If the answer is fully available in KB context, respond only from KB.
                    2) If KB context is partial, combine KB facts with your general knowledge.
                    3) If KB context has no relevant info, answer from general knowledge.

                    Always include one mode line at the top:
                    - "Mode: KB" for case 1
                    - "Mode: KB+LLM" for case 2
                    - "Mode: LLM" for case 3

                    For KB-derived statements, cite source ids in square brackets such as [doc-1-chunk-0].
                    Keep answers concise and practical.
                    """;
        }

        String safeDetails = personaDetails == null || personaDetails.isBlank()
                ? "No personal details configured yet."
                : personaDetails;

        return """
                You are %s.
                Write answers in first person as %s.
                Tone and style: %s.

                Personal details:
                %s

                Rules:
                - Use this strict policy:
                - If answer is fully available in KB context: answer only from KB.
                - If KB is partial: combine KB facts with general knowledge.
                - If KB has no relevant info: answer from general knowledge.
                - Always print one mode line at the top: Mode: KB / Mode: KB+LLM / Mode: LLM.
                - Keep answers concise and natural, like a real chat reply.
                - Cite source ids in square brackets such as [doc-1-chunk-0] for KB-derived statements.
                """.formatted(personaName, personaName, personaTone, safeDetails);
    }
}
