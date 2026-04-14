package com.example.webchat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChannelRepository extends JpaRepository<Channel, Long> {

    Optional<Channel> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Channel> findAllByOrderByNameAsc();
}
