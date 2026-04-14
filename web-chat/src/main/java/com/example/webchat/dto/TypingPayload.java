package com.example.webchat.dto;

public record TypingPayload(String type, String username, boolean typing) {
    public static final String TYPE_TYPING = "TYPING";

    public static TypingPayload of(String username, boolean typing) {
        return new TypingPayload(TYPE_TYPING, username, typing);
    }
}
