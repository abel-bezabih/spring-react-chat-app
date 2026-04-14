package com.example.webchat.dto;

import java.time.LocalDateTime;

public record ChannelResponse(
        Long id,
        String name,
        String slug,
        String description,
        LocalDateTime createdAt
) {}
