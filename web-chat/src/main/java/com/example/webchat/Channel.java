package com.example.webchat;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "channels")
public class Channel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(length = 500)
    private String description;

    private LocalDateTime createdAt;

    /** Username who created the channel (or "system" for default). */
    @Column(length = 64)
    private String createdByUsername;

    public Channel() {}

    public Channel(String name, String slug, String description, LocalDateTime createdAt, String createdByUsername) {
        this.name = name;
        this.slug = slug;
        this.description = description;
        this.createdAt = createdAt;
        this.createdByUsername = createdByUsername;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getCreatedByUsername() {
        return createdByUsername;
    }
}
