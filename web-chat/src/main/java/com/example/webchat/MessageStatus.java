package com.example.webchat;

/**
 * SENT: stored and ready to broadcast.
 * DELIVERED: broadcast attempt completed to all connected clients (best-effort).
 */
public enum MessageStatus {
    SENT,
    DELIVERED
}
