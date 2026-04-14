package com.example.webchat.dto;

import com.example.webchat.MessageStatus;
import java.time.LocalDateTime;

/**
 * Outbound WebSocket JSON for chat lines and history replay.
 */
public record ChatMessagePayload(
        String type,
        Long id,
        Long channelId,
        String sender,
        String content,
        LocalDateTime timestamp,
        MessageStatus status,
        String clientMessageId
) {
    public static final String TYPE_MESSAGE = "MESSAGE";

    public static ChatMessagePayload of(
            Long id,
            Long channelId,
            String sender,
            String content,
            LocalDateTime timestamp,
            MessageStatus status,
            String clientMessageId
    ) {
        return new ChatMessagePayload(TYPE_MESSAGE, id, channelId, sender, content, timestamp, status, clientMessageId);
    }
}
