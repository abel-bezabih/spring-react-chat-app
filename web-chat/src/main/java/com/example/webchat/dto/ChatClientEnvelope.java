package com.example.webchat.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Inbound WebSocket JSON from clients.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatClientEnvelope {

    public static final String TYPE_MESSAGE = "MESSAGE";
    public static final String TYPE_TYPING = "TYPING";

    private String type;
    private String content;
    /** Optional idempotency key so reconnect/retries do not duplicate messages. */
    private String clientMessageId;
    private Boolean typing;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getClientMessageId() {
        return clientMessageId;
    }

    public void setClientMessageId(String clientMessageId) {
        this.clientMessageId = clientMessageId;
    }

    public Boolean getTyping() {
        return typing;
    }

    public void setTyping(Boolean typing) {
        this.typing = typing;
    }
}
