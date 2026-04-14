package com.example.webchat.dto;

import com.example.webchat.MessageStatus;
import java.time.LocalDateTime;

public record MessageResponse(
        Long id,
        Long channelId,
        String sender,
        String content,
        LocalDateTime timestamp,
        MessageStatus status
) {}
