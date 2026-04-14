package com.example.webchat;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Ensures a default #general channel exists and attaches legacy messages without a channel.
 */
@Component
@Order(1)
public class ChannelDataInitializer implements ApplicationRunner {

    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;

    public ChannelDataInitializer(ChannelRepository channelRepository, MessageRepository messageRepository) {
        this.channelRepository = channelRepository;
        this.messageRepository = messageRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Channel general = channelRepository.findBySlug("general").orElseGet(() ->
                channelRepository.save(new Channel(
                        "general",
                        "general",
                        "Company-wide announcements and casual chat",
                        LocalDateTime.now(),
                        "system"
                )));
        messageRepository.clearNullChannels(general);
    }
}
