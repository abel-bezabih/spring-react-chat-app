package com.example.webchat;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.*;
import java.time.LocalDateTime;

@Component
public class ChatHandler extends TextWebSocketHandler {

    private static Set<WebSocketSession> sessions = Collections.synchronizedSet(new HashSet<>());

    private static MessageRepository messageRepo;

    public static void setMessageRepository(MessageRepository repo) {
        messageRepo = repo;
    }

    @Override
    public void afterConnectionEstablished(@org.springframework.lang.NonNull WebSocketSession session) throws Exception {
        sessions.add(session);

        // Send old messages
        if (messageRepo != null) {
            List<Message> history = messageRepo.findAll();
            for (Message msg : history) {
                session.sendMessage(new TextMessage(msg.getSender() + ": " + msg.getContent()));
            }
        }
    }

    @Override
    protected void handleTextMessage(@org.springframework.lang.NonNull WebSocketSession session, @org.springframework.lang.NonNull TextMessage textMessage) throws Exception {
        String content = textMessage.getPayload();
        String sender = (String) session.getAttributes().get("username");
        if (sender == null) {
            sender = "Anonymous";
        }

        if (messageRepo != null) {
            messageRepo.save(new Message(sender, content, LocalDateTime.now()));
        }

        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(sender + ": " + content));
            }
        }
    }

    @Override
    public void afterConnectionClosed(@org.springframework.lang.NonNull WebSocketSession session, @org.springframework.lang.NonNull CloseStatus status) {
        sessions.remove(session);
    }
}
