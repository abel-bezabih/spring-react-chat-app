package com.example.webchat;

import com.example.webchat.dto.MessageResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/messages")
@Validated
public class MessageController {

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;

    public MessageController(MessageRepository messageRepository, ChannelRepository channelRepository) {
        this.messageRepository = messageRepository;
        this.channelRepository = channelRepository;
    }

    /**
     * Cursor-based history for a channel: messages with id less than {@code beforeId}, oldest-first in the response.
     */
    @GetMapping
    public List<MessageResponse> history(
            @RequestParam long channelId,
            @RequestParam(required = false) Long beforeId,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit
    ) {
        if (!channelRepository.existsById(channelId)) {
            return List.of();
        }
        List<Message> chunk = messageRepository.findHistoryPage(channelId, beforeId, PageRequest.of(0, limit));
        List<Message> chronological = new ArrayList<>(chunk);
        Collections.reverse(chronological);
        return chronological.stream().map(this::toResponse).toList();
    }

    private MessageResponse toResponse(Message m) {
        Long chId = m.getChannel() != null ? m.getChannel().getId() : null;
        return new MessageResponse(m.getId(), chId, m.getSender(), m.getContent(), m.getTimestamp(), m.getStatus());
    }
}
