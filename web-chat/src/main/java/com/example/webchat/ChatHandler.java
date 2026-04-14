package com.example.webchat;

import com.example.webchat.dto.ChatClientEnvelope;
import com.example.webchat.dto.ChatMessagePayload;
import com.example.webchat.dto.TypingPayload;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatHandler extends TextWebSocketHandler {

    private static final int HISTORY_PAGE_SIZE = 200;
    private static final int MAX_CONTENT_LENGTH = 4000;

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final ObjectMapper objectMapper;

    /** Sessions keyed by channel id. */
    private final Map<Long, Set<WebSocketSession>> sessionsByChannel = new ConcurrentHashMap<>();

    public ChatHandler(
            MessageRepository messageRepository,
            ChannelRepository channelRepository,
            ObjectMapper objectMapper
    ) {
        this.messageRepository = messageRepository;
        this.channelRepository = channelRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        Long channelId = (Long) session.getAttributes().get("channelId");
        if (channelId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        sessionsByChannel
                .computeIfAbsent(channelId, k -> Collections.synchronizedSet(new HashSet<>()))
                .add(session);

        List<Message> history = messageRepository.findByChannelIdOrderByIdAsc(
                channelId,
                PageRequest.of(0, HISTORY_PAGE_SIZE)
        );
        for (Message msg : history) {
            sendJson(session, ChatMessagePayload.of(
                    msg.getId(),
                    channelId,
                    msg.getSender(),
                    msg.getContent(),
                    msg.getTimestamp(),
                    msg.getStatus(),
                    msg.getClientMessageId()
            ));
        }
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage textMessage) throws Exception {
        Long channelId = (Long) session.getAttributes().get("channelId");
        if (channelId == null) {
            return;
        }
        Channel channel = channelRepository.findById(channelId).orElse(null);
        if (channel == null) {
            return;
        }

        String sender = Optional.ofNullable((String) session.getAttributes().get("username")).orElse("Anonymous");
        ChatClientEnvelope env;
        try {
            env = objectMapper.readValue(textMessage.getPayload(), ChatClientEnvelope.class);
        } catch (JsonProcessingException e) {
            return;
        }
        if (env.getType() == null) {
            return;
        }
        if (ChatClientEnvelope.TYPE_TYPING.equalsIgnoreCase(env.getType())) {
            boolean typing = Boolean.TRUE.equals(env.getTyping());
            broadcastTyping(channelId, session, TypingPayload.of(sender, typing));
            return;
        }
        if (!ChatClientEnvelope.TYPE_MESSAGE.equalsIgnoreCase(env.getType())) {
            return;
        }
        String content = env.getContent() == null ? "" : env.getContent().trim();
        if (content.isEmpty() || content.length() > MAX_CONTENT_LENGTH) {
            return;
        }
        String clientMessageId = env.getClientMessageId() != null ? env.getClientMessageId().trim() : null;
        if (clientMessageId != null && clientMessageId.length() > 64) {
            return;
        }

        if (clientMessageId != null && !clientMessageId.isEmpty()) {
            Optional<Message> existing = messageRepository.findBySenderAndClientMessageIdAndChannel_Id(
                    sender, clientMessageId, channelId
            );
            if (existing.isPresent()) {
                Message m = existing.get();
                sendJson(session, ChatMessagePayload.of(
                        m.getId(),
                        channelId,
                        m.getSender(),
                        m.getContent(),
                        m.getTimestamp(),
                        m.getStatus(),
                        m.getClientMessageId()
                ));
                return;
            }
        }

        Message saved = new Message(sender, content, LocalDateTime.now(), channel);
        saved.setClientMessageId(clientMessageId);
        saved = messageRepository.save(saved);

        String json = objectMapper.writeValueAsString(ChatMessagePayload.of(
                saved.getId(),
                channelId,
                saved.getSender(),
                saved.getContent(),
                saved.getTimestamp(),
                MessageStatus.SENT,
                saved.getClientMessageId()
        ));
        broadcastText(channelId, json);

        saved.setStatus(MessageStatus.DELIVERED);
        messageRepository.save(saved);
    }

    private void broadcastTyping(Long channelId, WebSocketSession from, TypingPayload payload) throws IOException {
        String json = objectMapper.writeValueAsString(payload);
        Set<WebSocketSession> sessions = sessionsByChannel.get(channelId);
        if (sessions == null) {
            return;
        }
        synchronized (sessions) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen() && !s.getId().equals(from.getId())) {
                    s.sendMessage(new TextMessage(json));
                }
            }
        }
    }

    private void broadcastText(Long channelId, String json) throws IOException {
        Set<WebSocketSession> sessions = sessionsByChannel.get(channelId);
        if (sessions == null) {
            return;
        }
        synchronized (sessions) {
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    s.sendMessage(new TextMessage(json));
                }
            }
        }
    }

    private void sendJson(WebSocketSession session, ChatMessagePayload payload) throws IOException {
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        Long channelId = (Long) session.getAttributes().get("channelId");
        if (channelId != null) {
            Set<WebSocketSession> set = sessionsByChannel.get(channelId);
            if (set != null) {
                set.remove(session);
            }
        }
    }
}
